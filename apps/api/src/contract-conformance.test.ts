import type { CheckInInput } from '@akeso/domain'
import {
  apiResponseSchema,
  CoachReplySchema,
  DayPlanSchema,
  EnergyResultSchema,
  GetFridgeResponseSchema,
  GetReminderResponseSchema,
  PutFridgeItemResponseSchema,
} from '@akeso/contracts'
import request from 'supertest'
import { beforeEach, describe, expect, test } from 'vitest'

import { createApp } from './app'
import { createMemoryRepos } from './repos/memory'

/**
 * @akeso/contracts' apiContract route map mirrors the implemented /v1 API
 * 1:1 (see docs/API_CONTRACT.md). These tests prove the conformance holds at
 * runtime: real /v1 response bodies must parse against the contract's
 * response schemas, so a route drifting from the frozen contract fails here.
 */

const validCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 3,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp(createMemoryRepos())
})

describe('real /v1 responses conform to @akeso/contracts data schemas', () => {
  test('POST /v1/checkins → EnergyResult envelope', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send(validCheckIn)
      .expect(200)

    const result = apiResponseSchema(EnergyResultSchema).safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('GET /v1/energy/:date → EnergyResult envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app).get('/v1/energy/2026-07-21').expect(200)

    const result = apiResponseSchema(EnergyResultSchema).safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('GET /v1/plan/:date → DayPlan envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app).get('/v1/plan/2026-07-21').expect(200)

    const result = apiResponseSchema(DayPlanSchema).safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('GET /v1/coach/:date → CoachReply envelope', async () => {
    const response = await request(app).get('/v1/coach/2026-07-21').expect(200)

    const result = apiResponseSchema(CoachReplySchema).safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('400 VALIDATION_ERROR body conforms to the ApiError envelope shape', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send({ ...validCheckIn, reportedEnergy: 9 })
      .expect(400)

    const result = apiResponseSchema(EnergyResultSchema).safeParse(response.body)
    expect(result.success).toBe(true)
    expect(result.success && result.data.success).toBe(false)
  })

  test('GET /v1/fridge → FridgeItem[] envelope', async () => {
    const response = await request(app).get('/v1/fridge').expect(200)

    const result = GetFridgeResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('PUT /v1/fridge/:id → FridgeItem envelope', async () => {
    const response = await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)

    const result = PutFridgeItemResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('GET /v1/reminders → ReminderPreference envelope', async () => {
    const response = await request(app).get('/v1/reminders').expect(200)

    const result = GetReminderResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })
})
