import {
  batchFridgeItemsRequestSchema,
  fridgeItemSchema,
  fridgeItemParamsSchema,
  patchFridgeItemBodySchema,
  putFridgeItemBodySchema,
  type FridgeItem,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'
import multer from 'multer'

import { ok } from '../http'
import { HttpError } from '../http-error'
import type { Repos } from '../repos'
import type { AiServices, UploadedImage } from '../services/types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image')

const detectImageType = (bytes: Buffer): UploadedImage['mimeType'] | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

const normalizeName = (name: string) =>
  name.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

async function upsertDeduplicated(
  repos: Repos,
  userId: string,
  items: FridgeItem[]
): Promise<FridgeItem[]> {
  const existing = await repos.fridge.list(userId)
  const existingIds = new Set(existing.map((item) => item.id))
  const byName = new Map(existing.map((item) => [normalizeName(item.name), item]))
  const saved = new Map<string, FridgeItem>()
  for (const item of items) {
    const duplicate = byName.get(normalizeName(item.name))
    const canonical = duplicate ? { ...item, id: duplicate.id } : item
    // Renaming an existing item to collide with a different existing item's
    // name merges into that item's id — remove the old row so it doesn't
    // linger as an orphaned duplicate under its previous id.
    if (duplicate && item.id !== duplicate.id && existingIds.has(item.id)) {
      await repos.fridge.remove(userId, item.id)
      existingIds.delete(item.id)
    }
    const result = await repos.fridge.upsert(userId, canonical)
    byName.set(normalizeName(result.name), result)
    existingIds.add(result.id)
    saved.set(result.id, result)
  }
  return Array.from(saved.values())
}

export function createFridgeRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler,
  ai: AiServices
): Router {
  const router = Router()

  router.get('/fridge', async (req, res) => {
    const items = await repos.fridge.list(req.userId)
    ok(res, items)
  })

  router.get('/fridge-items', async (req, res) => {
    ok(res, await repos.fridge.list(req.userId))
  })

  router.post('/fridge-items', writeRateLimiter, async (req, res) => {
    const item = fridgeItemSchema.parse(req.body)
    const [saved] = await upsertDeduplicated(repos, req.userId, [item])
    ok(res, saved)
  })

  router.put('/fridge/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    const body = putFridgeItemBodySchema.parse(req.body)
    const [saved] = await upsertDeduplicated(repos, req.userId, [
      { id, ...body },
    ])
    ok(res, saved)
  })

  router.patch('/fridge-items/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    const body = patchFridgeItemBodySchema.parse(req.body)
    const existing = (await repos.fridge.list(req.userId)).find(
      (item) => item.id === id
    )
    if (!existing) throw new HttpError(404, 'NOT_FOUND', 'Fridge item not found.')
    const [saved] = await upsertDeduplicated(repos, req.userId, [
      { ...existing, ...body },
    ])
    ok(res, saved)
  })

  router.post('/fridge-items/batch', writeRateLimiter, async (req, res) => {
    const { items } = batchFridgeItemsRequestSchema.parse(req.body)
    ok(res, await upsertDeduplicated(repos, req.userId, items))
  })

  router.post(
    '/fridge/recognitions',
    writeRateLimiter,
    uploadImage,
    async (req, res) => {
      if (!req.file) {
        throw new HttpError(400, 'INVALID_IMAGE', 'multipart field "image" is required.')
      }
      const detectedMimeType = detectImageType(req.file.buffer)
      if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
        throw new HttpError(
          400,
          'INVALID_IMAGE',
          'Upload a valid JPEG, PNG, or WebP image.'
        )
      }
      ok(
        res,
        await ai.recognizeIngredients({
          bytes: req.file.buffer,
          mimeType: detectedMimeType,
        })
      )
    }
  )

  router.delete('/fridge/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    await repos.fridge.remove(req.userId, id)
    ok(res, null)
  })

  router.delete('/fridge-items/:id', writeRateLimiter, async (req, res) => {
    const { id } = fridgeItemParamsSchema.parse(req.params)
    await repos.fridge.remove(req.userId, id)
    ok(res, null)
  })

  return router
}
