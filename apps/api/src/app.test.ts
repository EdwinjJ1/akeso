import request from 'supertest'
import { describe, expect, test } from 'vitest'

import { createApp } from './app'

describe('Akeso API', () => {
  const app = createApp()

  test('reports API health through the shared success envelope', async () => {
    const response = await request(app).get('/health').expect(200)

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        version: '0.1.0',
      },
    })
    expect(response.body.data.uptimeSeconds).toEqual(expect.any(Number))
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  test('wraps an unknown route in the shared error envelope', async () => {
    const response = await request(app).get('/missing').expect(404)

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'No route for GET /missing',
      },
    })
  })

  test('returns a validation error for malformed JSON', async () => {
    const response = await request(app)
      .post('/missing')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400)

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed request body',
      },
    })
  })
})
