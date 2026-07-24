import type { CheckInInput } from '@akeso/domain'
import {
  AdjustEnergyResponseSchema,
  apiResponseSchema,
  CoachReplySchema,
  CreateContextNoteResponseSchema,
  CreateReportResponseSchema,
  GetCheckInResponseSchema,
  GetContextNotesResponseSchema,
  DayPlanSchema,
  EnergyResultSchema,
  UpdatePlanBlockResponseSchema,
  GetFridgeResponseSchema,
  GetNutritionResponseSchema,
  GetProfileResponseSchema,
  GetReportResponseSchema,
  GetReminderResponseSchema,
  PutFridgeItemResponseSchema,
  PutProfileResponseSchema,
  UpdateReportMetricsResponseSchema,
  UpdateReportResponseSchema,
} from '@akeso/contracts'
import request from 'supertest'
import { beforeEach, describe, expect, test } from 'vitest'

import { createApp } from './app'
import { createMemoryRepos } from './repos/memory'
import { createSqliteRepos } from './repos/sqlite'

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

/**
 * Both local repo drivers must satisfy the same API contract: memory (demo
 * mode) and sqlite (persistent local personal record). sqlite runs on
 * ':memory:' here so tests stay hermetic and leave no file behind.
 */
const repoDrivers = [
  ['memory', () => createMemoryRepos()],
  ['sqlite', () => createSqliteRepos(':memory:')],
] as const

describe.each(repoDrivers)(
  'real /v1 responses conform to @akeso/contracts data schemas (%s repos)',
  (_driver, createDriverRepos) => {
    beforeEach(() => {
      app = createApp(createDriverRepos())
    })
  test('GET /v1/profile -> UserProfile envelope', async () => {
    const response = await request(app).get('/v1/profile').expect(200)

    const result = GetProfileResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('PUT /v1/profile -> UserProfile envelope with dietary safety', async () => {
    const response = await request(app)
      .put('/v1/profile')
      .send({
        displayName: 'Alex',
        goal: 'academic',
        typicalWake: '07:30',
        typicalSleep: '23:30',
        dietaryPreference: 'none',
        dietarySafety: {
          allergens: ['milk'],
          avoidIngredients: ['salmon'],
        },
      })
      .expect(200)

    const result = PutProfileResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

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

  test('GET /v1/checkins/:date → CheckIn envelope (null then the saved input)', async () => {
    const before = await request(app).get('/v1/checkins/2026-07-21').expect(200)
    expect(before.body).toEqual({ success: true, data: null })

    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const after = await request(app).get('/v1/checkins/2026-07-21').expect(200)

    const result = GetCheckInResponseSchema.safeParse(after.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
    expect(after.body.data).toEqual(validCheckIn)
  })

  test('GET /v1/plan/:date → DayPlan envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app).get('/v1/plan/2026-07-21').expect(200)

    const result = apiResponseSchema(DayPlanSchema).safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('PATCH /v1/plan/:date/blocks/:blockId → updated DayPlan envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const plan = await request(app).get('/v1/plan/2026-07-21').expect(200)
    const block = plan.body.data.blocks[0]
    const response = await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${block.id}`)
      .send({
        title: 'Updated suggestion',
        start: block.start,
        end: block.end,
        status: 'completed',
      })
      .expect(200)

    const result = UpdatePlanBlockResponseSchema.safeParse(response.body)
    expect(
      result.success,
      JSON.stringify(result.success ? null : result.error.issues)
    ).toBe(true)
  })

  test('POST /v1/energy/:date/adjust → AdjustEnergy envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app)
      .post('/v1/energy/2026-07-21/adjust')
      .send({ score: 45, note: 'Long commute wiped me out' })
      .expect(200)

    const result = AdjustEnergyResponseSchema.safeParse(response.body)
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(
      true
    )
  })

  test('context notes GET/POST → ContextNote envelopes', async () => {
    const created = await request(app)
      .post('/v1/context/2026-07-21/notes')
      .send({ text: 'Feeling low after lunch' })
      .expect(200)
    const createdResult = CreateContextNoteResponseSchema.safeParse(created.body)
    expect(
      createdResult.success,
      JSON.stringify(createdResult.success ? null : createdResult.error.issues)
    ).toBe(true)

    const list = await request(app)
      .get('/v1/context/2026-07-21/notes')
      .expect(200)
    const listResult = GetContextNotesResponseSchema.safeParse(list.body)
    expect(
      listResult.success,
      JSON.stringify(listResult.success ? null : listResult.error.issues)
    ).toBe(true)
  })

  test('POST /v1/coach/:date/chat → CoachReply envelope', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app)
      .post('/v1/coach/2026-07-21/chat')
      .send({ message: 'How does my day look?' })
      .expect(200)

    const result = apiResponseSchema(CoachReplySchema).safeParse(response.body)
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

  test('GET /v1/nutrition/:date -> NutritionPlan envelope', async () => {
    const response = await request(app).get('/v1/nutrition/2026-07-21').expect(200)

    const result = GetNutritionResponseSchema.safeParse(response.body)
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

  test('report create/detail/metadata/metric responses conform to the report contract', async () => {
    const metric = {
      id: 'ferritin',
      name: 'Ferritin',
      value: 18,
      unit: 'µg/L',
      referenceLow: 30,
      referenceHigh: 200,
      status: 'normal',
      confidence: 0.91,
      uncertaintyReason: null,
      confirmed: true,
    }
    const created = await request(app)
      .post('/v1/reports')
      .send({ name: 'Blood test', reportDate: '2026-07-20', metrics: [metric] })
      .expect(201)
    expect(CreateReportResponseSchema.safeParse(created.body).success).toBe(true)
    const id = created.body.data.id as string

    const detail = await request(app).get(`/v1/reports/${id}`).expect(200)
    expect(GetReportResponseSchema.safeParse(detail.body).success).toBe(true)

    const metadata = await request(app)
      .patch(`/v1/reports/${id}`)
      .send({ name: 'Corrected blood test', reportDate: null })
      .expect(200)
    expect(UpdateReportResponseSchema.safeParse(metadata.body).success).toBe(true)

    const metrics = await request(app)
      .patch(`/v1/reports/${id}/metrics`)
      .send({ metrics: [{ ...metric, value: 35, status: 'low' }] })
      .expect(200)
    expect(UpdateReportMetricsResponseSchema.safeParse(metrics.body).success).toBe(true)
    expect(metrics.body.data.metrics[0].status).toBe('normal')
  })
  }
)
