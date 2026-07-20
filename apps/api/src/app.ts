import express from 'express'

import { requireAuth } from './middleware/auth'
import { errorHandler, notFoundHandler } from './middleware/error'
import { createRepos, type Repos } from './repos'
import { createCheckinsRouter } from './routes/checkins'
import { createCoachRouter } from './routes/coach'
import { createEnergyRouter } from './routes/energy'
import { healthRouter } from './routes/health'
import { createNutritionRouter } from './routes/nutrition'
import { createPlanRouter } from './routes/plan'
import { createProfileRouter } from './routes/profile'
import { createTasksRouter } from './routes/tasks'

export function createApp(repos: Repos = createRepos()) {
  const app = express()
  app.use(express.json())

  app.use(healthRouter)

  app.use('/v1', requireAuth)
  app.use('/v1', createCheckinsRouter(repos))
  app.use('/v1', createEnergyRouter(repos))
  app.use('/v1', createTasksRouter(repos))
  app.use('/v1', createPlanRouter(repos))
  app.use('/v1', createProfileRouter(repos))
  app.use('/v1', createNutritionRouter())
  app.use('/v1', createCoachRouter())

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
