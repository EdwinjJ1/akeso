import { EnergyEngine } from '@akeso/domain'
import type { CheckInInput } from '@akeso/domain'
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

beforeEach(() => {
  // Fresh in-memory repos per test so state never leaks across cases.
  app = createApp(createMemoryRepos())
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
    expect(response.body.data).toEqual([{ id: 'milk', name: 'Milk', category: 'dairy' }])
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
    expect(response.body.data).toEqual([{ id: 'milk', name: 'Oat milk', category: 'dairy' }])
  })

  test('PUT rejects an invalid category with 400 VALIDATION_ERROR', async () => {
    const response = await request(app)
      .put('/v1/fridge/mystery')
      .send({ name: 'Mystery leftovers', category: 'not_a_category' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
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
})

describe('reminders', () => {
  test('GET returns null before any preference is saved', async () => {
    const response = await request(app).get('/v1/reminders').expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })

  test('PUT validates and persists, GET reflects it', async () => {
    const pref = { enabled: true, checkInTime: '08:00', timezone: 'Australia/Sydney' }
    await request(app).put('/v1/reminders').send(pref).expect(200)
    const response = await request(app).get('/v1/reminders').expect(200)
    expect(response.body.data).toEqual(pref)
  })

  test('PUT rejects a malformed time string', async () => {
    const response = await request(app)
      .put('/v1/reminders')
      .send({ enabled: true, checkInTime: '8am', timezone: 'Australia/Sydney' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('PUT rejects an unknown timezone', async () => {
    const response = await request(app)
      .put('/v1/reminders')
      .send({ enabled: true, checkInTime: '08:00', timezone: 'Not/AZone' })
      .expect(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('nutrition and coach passthrough', () => {
  test('GET /v1/nutrition/:date returns the fixture adapted to the date', async () => {
    const response = await request(app).get('/v1/nutrition/2026-08-01').expect(200)
    expect(response.body.data.date).toBe('2026-08-01')
    expect(response.body.data.needs.length).toBeGreaterThan(0)
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
