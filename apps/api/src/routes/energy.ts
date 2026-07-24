import {
  EnergyEngine,
  localDateSchema,
  saveEnergyCalibrationInputSchema,
} from '@akeso/domain'
import { Router, type RequestHandler } from 'express'

import { loadEnergyHistory } from '../energy-history'
import { ok } from '../http'
import { HttpError } from '../http-error'
import type { Repos } from '../repos'

export function createEnergyRouter(
  repos: Repos,
  writeRateLimiter: RequestHandler
): Router {
  const router = Router()

  router.get('/energy/:date/replay', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const [input, persisted] = await Promise.all([
      repos.checkins.get(req.userId, date),
      repos.energy.get(req.userId, date),
    ])
    if (!input || !persisted) {
      throw new HttpError(404, 'NOT_FOUND', `No energy result exists for ${date}`)
    }
    const result = EnergyEngine.forVersion(
      persisted.algorithmVersion
    ).evaluate(input, { baseline: persisted.personalBaseline })
    ok(res, result)
  })

  router.put(
    '/energy/:date/calibration',
    writeRateLimiter,
    async (req, res) => {
      const date = localDateSchema.parse(req.params.date)
      const body = saveEnergyCalibrationInputSchema.parse(req.body)
      const checkin = await repos.checkins.get(req.userId, date)
      if (!checkin) {
        throw new HttpError(404, 'NOT_FOUND', `No check-in exists for ${date}`)
      }
      const calibration = await repos.energyCalibrations.upsert(req.userId, {
        date,
        actualEnergy: body.actualEnergy,
        // Audit metadata only. EnergyEngine never reads this wall-clock value,
        // so score replay remains deterministic.
        recordedAt: new Date().toISOString(),
      })
      ok(res, calibration)
    }
  )

  router.get('/energy/:date', async (req, res) => {
    const date = localDateSchema.parse(req.params.date)
    const result = await repos.energy.get(req.userId, date)
    ok(res, result)
  })

  return router
}
