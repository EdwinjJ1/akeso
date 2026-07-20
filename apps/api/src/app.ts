import express from 'express'

import { errorHandler, notFoundHandler } from './middleware/error'
import { healthRouter } from './routes/health'

export function createApp() {
  const app = express()
  app.use(express.json())

  app.use(healthRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
