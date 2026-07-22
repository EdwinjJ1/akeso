import {
  buildReportRecommendationsFallback,
  computeMetricStatus,
  createReportRequestSchema,
  healthReportSchema,
  healthRecommendationBlueprintSchema,
  healthRecommendationSetSchema,
  renderHealthRecommendationSet,
  reportWithConfirmedMetrics,
  reportParamsSchema,
  updateReportMetricsRequestSchema,
  updateReportRequestSchema,
  type HealthReport,
  type ReportMetric,
} from '@akeso/domain'
import { createHash, randomUUID } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import multer from 'multer'

import { env } from '../env'
import { ok } from '../http'
import { HttpError } from '../http-error'
import type { Repos } from '../repos'
import type { AiServices, UploadedImage } from '../services/types'
import { REPORT_RECOMMENDATION_PROMPT_VERSION } from '../services/mimo'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image')

/**
 * Report uploads are JPEG/PNG only for the MVP (no PDF). The declared MIME
 * type is never trusted — the byte signature is checked and must match.
 */
const detectReportImageType = (
  bytes: Buffer
): Exclude<UploadedImage['mimeType'], 'image/webp'> | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return 'image/png'
  }
  return null
}

/**
 * Rebuild the reviewed metrics under server control: the status is always
 * recomputed from the report's own bounds (never trusted from the client, so
 * an out-of-range flag can't be spoofed). Request validation rejects duplicate
 * ids/names before this function runs.
 */
const buildReviewedMetrics = (metrics: ReportMetric[]): ReportMetric[] => {
  return metrics.map((metric) => ({
    ...metric,
    status: computeMetricStatus(
      metric.value,
      metric.referenceLow,
      metric.referenceHigh
    ),
  }))
}

export function createReportsRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler,
  ai: AiServices
): Router {
  const router = Router()
  const recommendationModel =
    env.vision.provider === 'gemini'
      ? env.vision.geminiModel
      : env.vision.mimoModel

  // Recommendations depend only on currently confirmed metrics plus the
  // provider/model/prompt version. Unconfirmed recognition results are stored
  // for later correction but never cross the recommendation boundary.
  const recommendationCacheKey = (userId: string, report: HealthReport) => {
    const confirmed = reportWithConfirmedMetrics(report)
    return createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          reportId: report.id,
          metrics: confirmed.metrics,
          provider: env.vision.provider,
          model: recommendationModel,
          promptVersion: REPORT_RECOMMENDATION_PROMPT_VERSION,
        })
      )
      .digest('hex')
  }

  const loadReport = async (userId: string, id: string): Promise<HealthReport> => {
    const report = await repos.reports.get(userId, id)
    if (!report) throw new HttpError(404, 'NOT_FOUND', 'Report not found.')
    return report
  }

  router.post(
    '/reports/extractions',
    writeRateLimiter,
    uploadImage,
    async (req, res) => {
      if (!req.file) {
        throw new HttpError(400, 'INVALID_IMAGE', 'multipart field "image" is required.')
      }
      const detectedMimeType = detectReportImageType(req.file.buffer)
      if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
        throw new HttpError(400, 'INVALID_IMAGE', 'Upload a valid JPEG or PNG image.')
      }
      // The extracted metrics are never persisted here — the user must review
      // and confirm them via POST /reports first.
      ok(
        res,
        await ai.extractReportMetrics({
          bytes: req.file.buffer,
          mimeType: detectedMimeType,
        })
      )
    }
  )

  router.get('/reports', async (req, res) => {
    ok(res, await repos.reports.list(req.userId))
  })

  router.post('/reports', writeRateLimiter, async (req, res) => {
    const { name, reportDate, metrics } = createReportRequestSchema.parse(req.body)
    const report = healthReportSchema.parse({
      id: randomUUID(),
      name,
      reportDate,
      createdAt: new Date().toISOString(),
      metrics: buildReviewedMetrics(metrics),
    })
    ok(res, await repos.reports.upsert(req.userId, report), 201)
  })

  router.get('/reports/:id', async (req, res) => {
    const { id } = reportParamsSchema.parse(req.params)
    ok(res, await loadReport(req.userId, id))
  })

  router.patch('/reports/:id', writeRateLimiter, async (req, res) => {
    const { id } = reportParamsSchema.parse(req.params)
    const patch = updateReportRequestSchema.parse(req.body)
    const report = await loadReport(req.userId, id)
    const updated = healthReportSchema.parse({ ...report, ...patch })
    ok(res, await repos.reports.upsert(req.userId, updated))
  })

  router.patch('/reports/:id/metrics', writeRateLimiter, async (req, res) => {
    const { id } = reportParamsSchema.parse(req.params)
    const { metrics } = updateReportMetricsRequestSchema.parse(req.body)
    const report = await loadReport(req.userId, id)
    const updated = healthReportSchema.parse({
      ...report,
      metrics: buildReviewedMetrics(metrics),
    })
    // Sweep derived health data before the durable replacement. If cleanup
    // fails, the report remains unchanged instead of leaving orphaned advice.
    await repos.reportRecommendationCache.removeByReport(req.userId, id)
    ok(res, await repos.reports.upsert(req.userId, updated))
  })

  router.delete('/reports/:id', writeRateLimiter, async (req, res) => {
    const { id } = reportParamsSchema.parse(req.params)
    await loadReport(req.userId, id)
    // Deleting a report must not leave its cached recommendations behind: they
    // are derived health data for a report that no longer exists. Remove them
    // explicitly so both the in-memory and Supabase paths converge (Supabase
    // also cascades via the composite FK, so this is idempotent there).
    await repos.reportRecommendationCache.removeByReport(req.userId, id)
    await repos.reports.remove(req.userId, id)
    ok(res, null)
  })

  router.get('/reports/:id/recommendations', async (req, res) => {
    const { id } = reportParamsSchema.parse(req.params)
    const report = await loadReport(req.userId, id)
    const cached = await repos.reportRecommendationCache.get(
      req.userId,
      recommendationCacheKey(req.userId, report)
    )
    const parsed = cached ? healthRecommendationSetSchema.safeParse(cached) : null
    ok(
      res,
      parsed?.success
        ? parsed.data
        : buildReportRecommendationsFallback({ report })
    )
  })

  router.post(
    '/reports/:id/recommendations/regenerate',
    writeRateLimiter,
    async (req, res) => {
      const { id } = reportParamsSchema.parse(req.params)
      const report = await loadReport(req.userId, id)
      const confirmedReport = reportWithConfirmedMetrics(report)
      const sourceCacheKey = recommendationCacheKey(req.userId, report)
      // The AI returns only a text-free blueprint (action codes + metric ids).
      // Validate its structure here (an AI fault is a 502, not a client 400),
      // then render the user-visible set from the persisted confirmed report:
      // reportId, metrics, every title/detail, and the disclaimer all come from
      // the server, never the provider. Ungrounded citations are dropped during
      // rendering, so a buggy service cannot smuggle phantom metrics or free
      // text into what we cache or return.
      const blueprint = healthRecommendationBlueprintSchema.safeParse(
        await ai.generateHealthRecommendations({ report: confirmedReport })
      )
      if (!blueprint.success) {
        throw new HttpError(
          502,
          'MALFORMED_AI_OUTPUT',
          'AI recommendation output failed validation.'
        )
      }
      const recommendations = healthRecommendationSetSchema.parse(
        renderHealthRecommendationSet({
          report: confirmedReport,
          blueprint: blueprint.data,
        })
      )
      // AI calls can overlap a correction or deletion. Re-read under the same
      // owner and refuse to publish a result for an older metric snapshot.
      const currentReport = await loadReport(req.userId, id)
      if (recommendationCacheKey(req.userId, currentReport) !== sourceCacheKey) {
        throw new HttpError(
          409,
          'REPORT_CHANGED',
          'The report changed while advice was being generated. Try again.'
        )
      }
      await repos.reportRecommendationCache.upsert(
        req.userId,
        sourceCacheKey,
        recommendations
      )
      ok(res, recommendations)
    }
  )

  return router
}
