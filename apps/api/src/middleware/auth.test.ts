import request from 'supertest'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * The rest of the suite runs in DEMO_MODE (see vitest.config.ts) where
 * requireAuth's real branch — the one that actually checks a bearer token —
 * never executes. These tests force real mode so that branch, and the
 * per-user isolation it exists to provide, gets exercised at least once.
 *
 * Supabase's Postgrest client isn't mocked, only `auth.getUser` — so these
 * tests pass memory repos into createApp() directly rather than letting it
 * build Supabase-backed repos from the (fake) env config.
 */

const originalEnv = { ...process.env }

type GetUserResult =
  | { data: { user: { id: string } }; error: null }
  | { data: { user: null }; error: { message: string } }

function setRealAuthMode() {
  process.env.DEMO_MODE = 'false'
  process.env.NODE_ENV = 'test'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
}

async function buildRealModeApp(getUser: (token: string) => Promise<GetUserResult>) {
  setRealAuthMode()
  vi.doMock('../supabase', () => ({
    getSupabaseClient: () => ({ auth: { getUser } }),
  }))

  const { createApp } = await import('../app')
  const { createMemoryRepos } = await import('../repos/memory')
  return createApp(createMemoryRepos())
}

const validProfile = {
  displayName: 'Alice',
  goal: 'academic' as const,
  typicalWake: '07:00',
  typicalSleep: '23:00',
  dietaryPreference: 'none' as const,
  dietarySafety: {
    allergens: [],
    avoidIngredients: [],
  },
}

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
})

afterEach(() => {
  vi.doUnmock('../supabase')
  process.env = { ...originalEnv }
})

describe('requireAuth — real (non-demo) mode', () => {
  test('rejects a request with no bearer token', async () => {
    const app = await buildRealModeApp(async () => ({
      data: { user: null },
      error: { message: 'no token' },
    }))

    const response = await request(app).get('/v1/profile').expect(401)
    expect(response.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
    })
  })

  test('rejects an invalid or expired token', async () => {
    const app = await buildRealModeApp(async () => ({
      data: { user: null },
      error: { message: 'invalid JWT' },
    }))

    const response = await request(app)
      .get('/v1/profile')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401)
    expect(response.body).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    })
  })

  test('accepts a valid token and serves that request', async () => {
    const app = await buildRealModeApp(async (token) =>
      token === 'alice-token'
        ? { data: { user: { id: 'alice' } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }
    )

    const response = await request(app)
      .get('/v1/profile')
      .set('Authorization', 'Bearer alice-token')
      .expect(200)
    expect(response.body).toEqual({ success: true, data: null })
  })
})

describe('cross-user isolation', () => {
  test('one user cannot read or overwrite another user\'s profile', async () => {
    const userIdByToken: Record<string, string> = {
      'alice-token': 'alice-id',
      'bob-token': 'bob-id',
    }
    const app = await buildRealModeApp(async (token) =>
      userIdByToken[token]
        ? { data: { user: { id: userIdByToken[token] } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }
    )

    await request(app)
      .put('/v1/profile')
      .set('Authorization', 'Bearer alice-token')
      .send(validProfile)
      .expect(200)

    const bobsView = await request(app)
      .get('/v1/profile')
      .set('Authorization', 'Bearer bob-token')
      .expect(200)
    expect(bobsView.body).toEqual({ success: true, data: null })

    const alicesView = await request(app)
      .get('/v1/profile')
      .set('Authorization', 'Bearer alice-token')
      .expect(200)
    expect(alicesView.body.data).toEqual(validProfile)
  })

  test('one user cannot see or delete another user\'s fridge items', async () => {
    const userIdByToken: Record<string, string> = {
      'alice-token': 'alice-id',
      'bob-token': 'bob-id',
    }
    const app = await buildRealModeApp(async (token) =>
      userIdByToken[token]
        ? { data: { user: { id: userIdByToken[token] } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }
    )

    await request(app)
      .put('/v1/fridge/milk')
      .set('Authorization', 'Bearer alice-token')
      .send({ name: 'Milk', category: 'dairy' })
      .expect(200)

    const bobsFridge = await request(app)
      .get('/v1/fridge')
      .set('Authorization', 'Bearer bob-token')
      .expect(200)
    expect(bobsFridge.body.data).toEqual([])

    // Bob deleting an id he doesn't own must not remove Alice's item.
    await request(app)
      .delete('/v1/fridge/milk')
      .set('Authorization', 'Bearer bob-token')
      .expect(200)

    const alicesFridge = await request(app)
      .get('/v1/fridge')
      .set('Authorization', 'Bearer alice-token')
      .expect(200)
    expect(alicesFridge.body.data).toEqual([
      { id: 'milk', name: 'Milk', category: 'dairy', allergenTags: [] },
    ])
  })

  test('one user cannot read or modify another user\'s report', async () => {
    const userIdByToken: Record<string, string> = {
      'alice-token': 'alice-id',
      'bob-token': 'bob-id',
    }
    const app = await buildRealModeApp(async (token) =>
      userIdByToken[token]
        ? { data: { user: { id: userIdByToken[token] } }, error: null }
        : { data: { user: null }, error: { message: 'invalid' } }
    )

    const created = await request(app)
      .post('/v1/reports')
      .set('Authorization', 'Bearer alice-token')
      .send({
        name: 'Alice private panel',
        reportDate: '2026-07-20',
        metrics: [
          {
            id: 'vitamin-d',
            name: 'Vitamin D',
            value: 18,
            unit: 'ng/mL',
            referenceLow: 30,
            referenceHigh: 100,
            status: 'normal',
            confidence: 0.9,
            uncertaintyReason: null,
            confirmed: true,
          },
        ],
      })
      .expect(201)
    const id = created.body.data.id

    await request(app)
      .get(`/v1/reports/${id}`)
      .set('Authorization', 'Bearer bob-token')
      .expect(404)
    await request(app)
      .patch(`/v1/reports/${id}`)
      .set('Authorization', 'Bearer bob-token')
      .send({ name: 'Stolen' })
      .expect(404)
    await request(app)
      .patch(`/v1/reports/${id}/metrics`)
      .set('Authorization', 'Bearer bob-token')
      .send({ metrics: created.body.data.metrics })
      .expect(404)
    await request(app)
      .get(`/v1/reports/${id}/recommendations`)
      .set('Authorization', 'Bearer bob-token')
      .expect(404)
    await request(app)
      .post(`/v1/reports/${id}/recommendations/regenerate`)
      .set('Authorization', 'Bearer bob-token')
      .expect(404)
    await request(app)
      .delete(`/v1/reports/${id}`)
      .set('Authorization', 'Bearer bob-token')
      .expect(404)

    const unchanged = await request(app)
      .get(`/v1/reports/${id}`)
      .set('Authorization', 'Bearer alice-token')
      .expect(200)
    expect(unchanged.body.data.name).toBe('Alice private panel')
  })
})
