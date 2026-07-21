import { localDateSchema, ZodError } from '@akeso/domain'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'

import { errorHandler } from './error'

/**
 * All runtime validators live in @akeso/contracts (one physical zod copy),
 * and @akeso/domain re-exports its ZodError, so the `instanceof` fast path
 * in errorHandler matches every schema this codebase throws. The duck-typing
 * fallback stays as defence-in-depth: npm nests a separate zod copy per
 * workspace package (Expo's CLI pins zod v3), so a future package that
 * validates with its own zod install would throw a ZodError of a different
 * class — that must still map to 400, not an unhandled 500.
 */
function appThatThrows(err: unknown) {
  const app = express()
  app.get('/boom', () => {
    throw err
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler ZodError detection', () => {
  test('contract schema ZodError → 400 VALIDATION_ERROR via instanceof', async () => {
    let thrown: unknown
    try {
      localDateSchema.parse('not-a-date')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ZodError)

    const response = await request(appThatThrows(thrown)).get('/boom')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('a foreign zod copy’s ZodError (different class) → 400 via duck-typing, not 500', async () => {
    const foreign = Object.assign(new Error('validation failed'), {
      name: 'ZodError',
      issues: [{ path: ['date'], message: 'expected YYYY-MM-DD' }],
    })
    // A different physical zod install fails instanceof against our class.
    expect(foreign).not.toBeInstanceOf(ZodError)

    const response = await request(appThatThrows(foreign)).get('/boom')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
