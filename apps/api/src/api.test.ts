import { EnergyEngine } from '@akeso/domain'
import type { CheckInInput } from '@akeso/domain'
import request from 'supertest'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createApp } from './app'
import { env } from './env'
import { createMemoryRepos } from './repos/memory'
import type { Repos } from './repos/types'

const validCheckIn: CheckInInput = {
  date: '2026-07-21',
  reportedEnergy: 3,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

let app: ReturnType<typeof createApp>
let repos: Repos

beforeEach(() => {
  // Fresh in-memory repos per test so state never leaks across cases.
  repos = createMemoryRepos()
  app = createApp(repos)
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

describe('PATCH /v1/plan/:date/blocks/:blockId', () => {
  test('persists one block without rewriting the entire day', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const originalPlan = await request(app)
      .get('/v1/plan/2026-07-21')
      .expect(200)
    const original = originalPlan.body.data.blocks[0]
    const wholePlanUpsert = vi.spyOn(repos.plans, 'upsert')
    const updateBlock = vi.spyOn(repos.plans, 'updateBlock')

    await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${original.id}`)
      .send({
        title: 'Atomic block update',
        start: original.start,
        end: original.end,
        status: 'completed',
      })
      .expect(200)

    expect(updateBlock).toHaveBeenCalledWith(
      expect.any(String),
      '2026-07-21',
      expect.objectContaining({
        id: original.id,
        title: 'Atomic block update',
        status: 'completed',
        source: 'user',
      })
    )
    expect(wholePlanUpsert).not.toHaveBeenCalled()
  })

  test('persists editable fields while leaving energy and rationale unchanged', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const energyBefore = await request(app)
      .get('/v1/energy/2026-07-21')
      .expect(200)
    const originalPlan = await request(app)
      .get('/v1/plan/2026-07-21')
      .expect(200)
    const original = originalPlan.body.data.blocks[0]

    const response = await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${original.id}`)
      .send({
        title: 'My updated morning block',
        start: original.start,
        end: original.end,
        status: 'completed',
      })
      .expect(200)

    const updated = response.body.data.blocks.find(
      (block: { id: string }) => block.id === original.id
    )
    expect(updated).toMatchObject({
      title: 'My updated morning block',
      status: 'completed',
      source: 'user',
      energyLevel: original.energyLevel,
      rationale: original.rationale,
      originalSuggestion: {
        title: original.title,
        start: original.start,
        end: original.end,
      },
    })

    const refreshed = await request(app).get('/v1/plan/2026-07-21').expect(200)
    expect(refreshed.body.data).toEqual(response.body.data)
    const energyAfter = await request(app)
      .get('/v1/energy/2026-07-21')
      .expect(200)
    expect(energyAfter.body).toEqual(energyBefore.body)
  })

  test('rejects overlaps and immutable fields', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const plan = await request(app).get('/v1/plan/2026-07-21').expect(200)
    const [first, second] = plan.body.data.blocks

    const overlap = await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${first.id}`)
      .send({
        title: first.title,
        start: second.start,
        end: second.end,
        status: 'planned',
      })
      .expect(400)
    expect(overlap.body.error.code).toBe('VALIDATION_ERROR')

    const immutable = await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${first.id}`)
      .send({
        title: first.title,
        start: first.start,
        end: first.end,
        status: 'planned',
        energyLevel: 'low',
      })
      .expect(400)
    expect(immutable.body.error.code).toBe('VALIDATION_ERROR')
  })

  test('returns 404 when the plan or block does not exist', async () => {
    const noPlan = await request(app)
      .patch('/v1/plan/2026-07-21/blocks/block-1')
      .send({
        title: 'Missing',
        start: '09:00',
        end: '10:00',
        status: 'planned',
      })
      .expect(404)
    expect(noPlan.body.error.code).toBe('NOT_FOUND')

    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    await request(app).get('/v1/plan/2026-07-21').expect(200)
    const noBlock = await request(app)
      .patch('/v1/plan/2026-07-21/blocks/missing-block')
      .send({
        title: 'Missing',
        start: '09:00',
        end: '10:00',
        status: 'planned',
      })
      .expect(404)
    expect(noBlock.body.error.code).toBe('NOT_FOUND')
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

  test('preserves user-updated blocks during regeneration', async () => {
    await request(app).post('/v1/checkins').send(validCheckIn).expect(200)
    const originalPlan = await request(app)
      .get('/v1/plan/2026-07-21')
      .expect(200)
    const original = originalPlan.body.data.blocks[0]
    await request(app)
      .patch(`/v1/plan/2026-07-21/blocks/${original.id}`)
      .send({
        title: 'Keep my morning edit',
        start: original.start,
        end: original.end,
        status: 'completed',
      })
      .expect(200)

    const response = await request(app)
      .post('/v1/plan/2026-07-21/regenerate')
      .send({})
      .expect(200)

    expect(
      response.body.data.plan.blocks.find(
        (block: { id: string }) => block.id === original.id
      )
    ).toMatchObject({
      title: 'Keep my morning edit',
      status: 'completed',
      source: 'user',
    })
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
