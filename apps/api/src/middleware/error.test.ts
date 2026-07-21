import { CheckInInputSchema } from '@akeso/contracts'
import { localDateSchema, ZodError as ZodErrorV4 } from '@akeso/domain'
import express from 'express'
import request from 'supertest'
import { describe, expect, test } from 'vitest'

import { errorHandler } from './error'

/**
 * @akeso/domain pins zod v4, @akeso/contracts pins zod v3 — npm gives each
 * workspace its own physical copy, so their ZodError classes fail
 * `instanceof` against each other. This proves errorHandler still returns
 * 400 (not an unhandled 500) for a validation error thrown by a route that
 * validates against a contracts (v3) schema, not just a domain (v4) one.
 */
function appThatThrows(err: unknown) {
  const app = express()
  app.get('/boom', () => {
    throw err
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler ZodError detection across zod v3/v4', () => {
  test('domain (zod v4) ZodError → 400 VALIDATION_ERROR', async () => {
    let thrown: unknown
    try {
      localDateSchema.parse('not-a-date')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ZodErrorV4)

    const response = await request(appThatThrows(thrown)).get('/boom')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('contracts (zod v3) ZodError → 400 VALIDATION_ERROR, not 500', async () => {
    let thrown: unknown
    try {
      CheckInInputSchema.parse({})
    } catch (e) {
      thrown = e
    }
    // Different physical zod install — must NOT be instanceof domain's ZodError.
    expect(thrown).not.toBeInstanceOf(ZodErrorV4)

    const response = await request(appThatThrows(thrown)).get('/boom')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
