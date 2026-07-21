import { EnergyEngine } from '@akeso/domain'
import type { CheckInInput } from '@akeso/domain'
import type { AiServices } from './services/types'
import request from 'supertest'
import { beforeEach, describe, expect, test } from 'vitest'

import { createApp } from './app'
import { env } from './env'
import { createMemoryRepos } from './repos/memory'

const validCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 3,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

let app: ReturnType<typeof createApp>

const fakeAiServices: AiServices = {
  async recognizeIngredients() {
    return {
      status: 'ok',
      ingredients: [
        {
          name: 'Tomato',
          category: 'vegetable',
          confidence: 0.93,
          uncertaintyReason: null,
        },
      ],
    }
  },
  async generateNutrition({ date, fridge }) {
    return {
      date,
      needs: [],
      fridge,
      meals: fridge.length
        ? [
            {
              id: 'meal-1',
              slot: 'lunch',
              title: `Use ${fridge[0].name}`,
              description: 'Uses a confirmed fridge ingredient.',
              usesFridgeItemIds: [fridge[0].id],
              allergenTags: fridge[0].allergenTags,
              boosts: [],
              prepMinutes: 10,
              tags: ['confirmed fridge'],
            },
          ]
        : [],
      rationale: fridge.length
        ? 'Generated from confirmed inventory.'
        : 'Add and confirm fridge ingredients first.',
    }
  },
}

beforeEach(() => {
  // Fresh in-memory repos per test so state never leaks across cases.
  app = createApp(createMemoryRepos(), fakeAiServices)
})

describe('POST /v1/checkins', () => {
  test('persists the check-in and returns a real EnergyEngine result', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send(validCheckIn)
      .expect(200)

    const expected = new EnergyEngine().evaluate(validCheckIn)
    expect(response.body).toMatchObject({
      success: true,
      data: { date: '2026-07-21', score: expected.score, band: expected.band },
    })
  })

  test('rejects an out-of-range scale value with 400 VALIDATION_ERROR', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send({ ...validCheckIn, reportedEnergy: 9 })
      .expect(400)

    expect(response.body.success).toBe(false)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('rejects a malformed date', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send({ ...validCheckIn, date: '21-07-2026' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /v1/energy/:date', () => {
  test('returns null before any check-in', async () => {
    const response = await request(app).get('/v1/energy/2026-07-21').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('returns the persisted result after a check-in', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app).get('/v1/energy/2026-07-21').expect(200)
    expect(response.body.data.date).toBe('2026-07-21')
  })
})

describe('GET /v1/tasks', () => {
  test('requires a date query param', async () => {
    const response = await request(app).get('/v1/tasks').expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('returns the demo task list', async () => {
    const response = await request(app)
      .get('/v1/tasks')
      .query({ date: '2026-07-21' })
      .expect(200)
    expect(Array.isArray(response.body.data)).toBe(true)
    expect(response.body.data.length).toBeGreaterThan(0)
  })
})

describe('GET /v1/plan/:date', () => {
  test('returns null until a check-in exists', async () => {
    const response = await request(app).get('/v1/plan/2026-07-21').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('generates and persists a plan once a check-in exists', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app).get('/v1/plan/2026-07-21').expect(200)

    expect(response.body.data.date).toBe('2026-07-21')
    expect(response.body.data.blocks.length).toBeGreaterThan(0)
  })

  test('is stable across repeated GETs (not regenerated every request)', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const first = await request(app).get('/v1/plan/2026-07-21').expect(200)
    const second = await request(app).get('/v1/plan/2026-07-21').expect(200)
    expect(second.body).toEqual(first.body)
  })
})

describe('POST /v1/plan/:date/regenerate', () => {
  test('404s when there is no check-in yet', async () => {
    const response = await request(app)
      .post('/v1/plan/2026-07-21/regenerate')
      .send({})
      .expect(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  test('regenerates the plan and returns a coach reply', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const response = await request(app)
      .post('/v1/plan/2026-07-21/regenerate')
      .send({ instruction: 'more rest' })
      .expect(200)

    expect(response.body.data.plan.coachNote).toContain('more rest')
    expect(response.body.data.coach.disclaimer).toBeTruthy()
  })
})

describe('profile', () => {
  test('GET returns null before any profile is saved', async () => {
    const response = await request(app).get('/v1/profile').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('PUT validates and persists, GET reflects it', async () => {
    const profile = {
      displayName: 'Alex',
      goal: 'academic',
      typicalWake: '07:30',
      typicalSleep: '23:30',
      dietaryPreference: 'none',
      dietarySafety: {
        allergens: [],
        avoidIngredients: [],
      },
    }
    await request(app).put('/v1/profile').send(profile).expect(200)
    const response = await request(app).get('/v1/profile').expect(200)
    expect(response.body.data).toEqual(profile)
  })

  test('PUT rejects a malformed time string', async () => {
    const response = await request(app)
      .put('/v1/profile')
      .send({
        displayName: 'Alex',
        goal: 'academic',
        typicalWake: '7:30am',
        typicalSleep: '23:30',
        dietaryPreference: 'none',
        dietarySafety: {
          allergens: [],
          avoidIngredients: [],
        },
      })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('fridge', () => {
  test('GET returns an empty list before anything is saved', async () => {
    const response = await request(app).get('/v1/fridge').expect(200)
    expect(response.body).toEqual({ success: true, data: [] })
  })

  test('PUT upserts by path id and GET reflects it', async () => {
    await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)

    const response = await request(app).get('/v1/fridge').expect(200)
    expect(response.body.data).toEqual([
      { id: 'milk', name: 'Milk', category: 'dairy', allergenTags: [] },
    ])
  })

  test('PUT with the same id twice overwrites rather than duplicating', async () => {
    await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)
    await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Oat milk', category: 'dairy' })
      .expect(200)

    const response = await request(app).get('/v1/fridge').expect(200)
    expect(response.body.data).toEqual([
      { id: 'milk', name: 'Oat milk', category: 'dairy', allergenTags: [] },
    ])
  })

  test('renaming an item into an existing name merges without leaving an orphan', async () => {
    await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)
    await request(app)
      .put('/v1/fridge/oat-milk')
      .send({ name: 'Oat milk', category: 'dairy' })
      .expect(200)

    // Renaming "oat-milk" to collide with "milk"'s name should merge into
    // the existing "milk" row, not leave a stale "oat-milk" row behind.
    await request(app)
      .put('/v1/fridge/oat-milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)

    const response = await request(app).get('/v1/fridge').expect(200)
    expect(response.body.data).toEqual([
      { id: 'milk', name: 'Milk', category: 'dairy', allergenTags: [] },
    ])
  })

  test('PUT rejects an invalid category with 400 VALIDATION_ERROR', async () => {
    const response = await request(app)
      .put('/v1/fridge/mystery')
      .send({ name: 'Mystery leftovers', category: 'not_a_category' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('POST and partial PATCH aliases provide presence-only CRUD', async () => {
    await request(app)
      .post('/v1/fridge-items')
      .send({ id: 'apple', name: 'Apple', category: 'fruit' })
      .expect(200)
    await request(app)
      .patch('/v1/fridge-items/apple')
      .send({ name: 'Green apple' })
      .expect(200)
    const response = await request(app).get('/v1/fridge-items').expect(200)
    expect(response.body.data).toEqual([
      { id: 'apple', name: 'Green apple', category: 'fruit', allergenTags: [] },
    ])
  })

  test('DELETE removes the item', async () => {
    await request(app)
      .put('/v1/fridge/milk')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)
    await request(app).delete('/v1/fridge/milk').expect(200)

    const response = await request(app).get('/v1/fridge').expect(200)
    expect(response.body.data).toEqual([])
  })

  test('DELETE of an id that never existed is a no-op, not an error', async () => {
    const response = await request(app).delete('/v1/fridge/never-existed').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('recognition returns editable candidates without writing inventory', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    const response = await request(app)
      .post('/v1/fridge/recognitions')
      .attach('image', jpeg, { filename: 'fridge.jpg', contentType: 'image/jpeg' })
      .expect(200)

    expect(response.body.data.ingredients).toEqual([
      expect.objectContaining({ name: 'Tomato', confidence: 0.93 }),
    ])
    const inventory = await request(app).get('/v1/fridge').expect(200)
    expect(inventory.body.data).toEqual([])
  })

  test('recognition rejects a spoofed image MIME type by file signature', async () => {
    const response = await request(app)
      .post('/v1/fridge/recognitions')
      .attach('image', Buffer.from('not an image'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400)
    expect(response.body.error.code).toBe('INVALID_IMAGE')
  })

  test('recognition rejects images larger than 5 MiB without writing them', async () => {
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)
    oversized.set([0xff, 0xd8, 0xff], 0)
    const response = await request(app)
      .post('/v1/fridge/recognitions')
      .attach('image', oversized, {
        filename: 'oversized.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413)
    expect(response.body.error.code).toBe('INVALID_IMAGE')
  })

  test('batch persists only items the user submitted as confirmed', async () => {
    const response = await request(app)
      .post('/v1/fridge-items/batch')
      .send({
        items: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' }],
      })
      .expect(200)

    expect(response.body.data).toEqual([
      { id: 'tomato', name: 'Tomato', category: 'vegetable', allergenTags: [] },
    ])
    const inventory = await request(app).get('/v1/fridge').expect(200)
    expect(inventory.body.data).toHaveLength(1)
  })

  test('batch deduplicates normalized ingredient names', async () => {
    const response = await request(app)
      .post('/v1/fridge-items/batch')
      .send({
        items: [
          { id: 'oat-1', name: ' Oat   milk ', category: 'dairy' },
          { id: 'oat-2', name: 'oat milk', category: 'other' },
        ],
      })
      .expect(200)
    expect(response.body.data).toHaveLength(1)
    const inventory = await request(app).get('/v1/fridge').expect(200)
    expect(inventory.body.data).toHaveLength(1)
  })
})

describe('reminders', () => {
  test('GET returns null before any preference is saved', async () => {
    const response = await request(app).get('/v1/reminders').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('PUT validates and persists, GET reflects it', async () => {
    const pref = { enabled: true, checkInTime: '08:00' }
    await request(app).put('/v1/reminders').send(pref).expect(200)
    const response = await request(app).get('/v1/reminders').expect(200)
    expect(response.body.data).toEqual(pref)
  })

  test('PUT rejects a malformed time string', async () => {
    const response = await request(app)
      .put('/v1/reminders')
      .send({ enabled: true, checkInTime: '8am' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('nutrition and coach', () => {
  test('empty confirmed inventory produces no invented meals', async () => {
    const response = await request(app).get('/v1/nutrition/2026-08-01').expect(200)
    expect(response.body.data.date).toBe('2026-08-01')
    expect(response.body.data.fridge).toEqual([])
    expect(response.body.data.meals).toEqual([])
  })

  test('regeneration uses only persisted inventory ids', async () => {
    await request(app)
      .post('/v1/fridge-items/batch')
      .send({ items: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' }] })
      .expect(200)
    const response = await request(app)
      .post('/v1/nutrition/2026-08-01/regenerate')
      .expect(200)
    expect(response.body.data.fridge).toEqual([
      { id: 'tomato', name: 'Tomato', category: 'vegetable', allergenTags: [] },
    ])
    expect(response.body.data.meals[0].usesFridgeItemIds).toEqual(['tomato'])
    expect(response.body.data.meals[0].allergenTags).toEqual([])
  })

  test('cached AI plan is invalidated when confirmed inventory changes', async () => {
    await request(app)
      .post('/v1/fridge-items/batch')
      .send({ items: [{ id: 'tomato', name: 'Tomato', category: 'vegetable' }] })
      .expect(200)
    await request(app)
      .post('/v1/nutrition/2026-08-01/regenerate')
      .expect(200)

    const cached = await request(app).get('/v1/nutrition/2026-08-01').expect(200)
    expect(cached.body.data.meals).toHaveLength(1)

    await request(app)
      .post('/v1/fridge-items/batch')
      .send({ items: [{ id: 'rice', name: 'Rice', category: 'grain' }] })
      .expect(200)
    const invalidated = await request(app)
      .get('/v1/nutrition/2026-08-01')
      .expect(200)
    expect(invalidated.body.data.fridge.map((item: { id: string }) => item.id)).toEqual([
      'tomato',
      'rice',
    ])
    expect(invalidated.body.data.meals[0].usesFridgeItemIds).toEqual([
      'tomato',
      'rice',
    ])
  })

  test('rate-limits repeated regeneration requests (the AI-calling path)', async () => {
    for (let i = 0; i < env.rateLimit.writeMax; i++) {
      await request(app).post('/v1/nutrition/2026-08-01/regenerate').expect(200)
    }
    const response = await request(app)
      .post('/v1/nutrition/2026-08-01/regenerate')
      .expect(429)
    expect(response.body.error.code).toBe('RATE_LIMITED')
  })

  test('GET /v1/nutrition/:date filters meals matching the saved safety profile', async () => {
    await request(app)
      .put('/v1/profile')
      .send({
        displayName: 'Alex',
        goal: 'academic',
        typicalWake: '07:30',
        typicalSleep: '23:30',
        dietaryPreference: 'none',
        dietarySafety: {
          allergens: ['milk'],
          avoidIngredients: [],
        },
      })
      .expect(200)
    await request(app)
      .post('/v1/fridge-items/batch')
      .send({
        items: [
          { id: 'milk', name: 'Milk', category: 'dairy', allergenTags: ['milk'] },
        ],
      })
      .expect(200)

    const response = await request(app).get('/v1/nutrition/2026-08-01').expect(200)
    expect(response.body.data.meals).toEqual([])
  })

  test('GET /v1/coach/:date always includes the non-medical disclaimer', async () => {
    const response = await request(app).get('/v1/coach/2026-08-01').expect(200)
    expect(response.body.data.disclaimer).toBeTruthy()
  })
})

describe('hardening', () => {
  test('does not advertise the framework via X-Powered-By', async () => {
    const response = await request(app).get('/health')
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  test('CORS: allows a configured origin', async () => {
    const origin = env.corsOrigins[0]
    const response = await request(app)
      .options('/v1/checkins')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
    expect(response.headers['access-control-allow-origin']).toBe(origin)
  })

  test('CORS: does not echo an unconfigured origin', async () => {
    const response = await request(app)
      .options('/v1/checkins')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST')
    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  test('rejects an oversized body with 413 (not a raw 500)', async () => {
    const response = await request(app)
      .post('/v1/checkins')
      .send({ ...validCheckIn, lastMealDescription: 'x'.repeat(200_000) })
      .expect(413)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('rate-limits repeated writes to /v1/checkins', async () => {
    for (let i = 0; i < env.rateLimit.writeMax; i++) {
      await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    }
    const response = await request(app)
      .post('/v1/checkins')
      .send(validCheckIn)
      .expect(429)
    expect(response.body.error.code).toBe('RATE_LIMITED')
  })
})
