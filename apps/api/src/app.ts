import cors from 'cors'
import express from 'express'

import { env } from './env'
import { requireAuth } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error'
import { createRateLimiters } from './middleware/rate-limit'
import { createRepos, type Repos } from './repos'
import { createCheckinsRouter } from './routes/checkins'
import { createCoachRouter } from './routes/coach'
import { createEnergyRouter } from './routes/energy'
import { createFridgeRouter } from './routes/fridge'
import { healthRouter } from './routes/health'
import { createNutritionRouter } from './routes/nutrition'
import { createPlanRouter } from './routes/plan'
import { createProfileRouter } from './routes/profile'
import { createRemindersRouter } from './routes/reminders'
import { createReportsRouter } from './routes/reports'
import { createTasksRouter } from './routes/tasks'
import { createAiServices } from './services/ai'
import type { AiServices } from './services/types'

export function createApp(
  repos: Repos = createRepos(),
  ai: AiServices = createAiServices()
) {
  const { apiRateLimiter, writeRateLimiter } = createRateLimiters()

  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: env.corsOrigins }))
  app.use(express.json())

  app.use(healthRouter)

  // Rate limiting must run BEFORE auth: requireAuth's non-demo branch makes
  // a network call to Supabase Auth per request, so an invalid-token flood
  // that skipped the limiter would hammer that upstream unthrottled.
  app.use('/v1', apiRateLimiter)
  app.use('/v1', requireAuth)
  app.use('/v1', createCheckinsRouter(repos, writeRateLimiter))
  app.use('/v1', createEnergyRouter(repos))
  app.use('/v1', createTasksRouter(repos))
  app.use('/v1', createPlanRouter(repos, writeRateLimiter, ai))
  app.use('/v1', createProfileRouter(repos))
  app.use('/v1', createNutritionRouter(repos, ai, writeRateLimiter))
  app.use('/v1', createCoachRouter(repos))
  app.use('/v1', createFridgeRouter(repos, writeRateLimiter, ai))
  app.use('/v1', createReportsRouter(repos, writeRateLimiter, ai))
  app.use('/v1', createRemindersRouter(repos, writeRateLimiter))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
