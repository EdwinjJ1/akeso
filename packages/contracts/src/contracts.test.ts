import { describe, expect, it } from 'vitest'
import {
  apiContract,
  CheckInResponseSchema,
  CoachRequestSchema,
  CoachResponseSchema,
  PlanQuerySchema,
  PlanResponseSchema,
} from './api'
import {
  fixtureApiError,
  fixtureCheckIn,
  fixtureCoachReply,
  fixtureCoachRequest,
  fixtureDayPlan,
  fixtureEnergyResult,
  fixtureTasks,
} from './fixtures'
import {
  CheckInInputSchema,
  CoachReplySchema,
  DayPlanSchema,
  EnergyResultSchema,
  TaskSchema,
} from './schemas'

describe('fixtures satisfy the frozen schemas', () => {
  it('CheckInInput', () => {
    expect(CheckInInputSchema.parse(fixtureCheckIn)).toEqual(fixtureCheckIn)
  })

  it('EnergyResult with score 78', () => {
    const parsed = EnergyResultSchema.parse(fixtureEnergyResult)
    expect(parsed.score).toBe(78)
    expect(parsed.factors).toHaveLength(6)
    expect(parsed.curve.length).toBeGreaterThanOrEqual(2)
  })

  it('every Task', () => {
    for (const task of fixtureTasks) {
      expect(TaskSchema.parse(task)).toEqual(task)
    }
  })

  it('DayPlan', () => {
    expect(DayPlanSchema.parse(fixtureDayPlan)).toEqual(fixtureDayPlan)
  })

  it('CoachReply', () => {
    expect(CoachReplySchema.parse(fixtureCoachReply)).toEqual(fixtureCoachReply)
  })
})

describe('fixtures are internally consistent', () => {
  it('every plan block taskId points at a fixture task', () => {
    const taskIds = new Set(fixtureTasks.map((t) => t.id))
    const referenced = fixtureDayPlan.blocks
      .map((b) => b.taskId)
      .filter((id): id is string => id !== undefined)
    expect(referenced.length).toBeGreaterThan(0)
    for (const id of referenced) {
      expect(taskIds.has(id)).toBe(true)
    }
  })

  it('energy curve hours are strictly ascending', () => {
    const hours = fixtureEnergyResult.curve.map((p) => p.hour)
    expect([...hours].sort((a, b) => a - b)).toEqual(hours)
    expect(new Set(hours).size).toBe(hours.length)
  })

  it('coach suggestions cite factor keys or plan block ids', () => {
    const evidence = new Set([
      ...fixtureEnergyResult.factors.map((f) => f.key as string),
      ...fixtureDayPlan.blocks.map((b) => b.id),
    ])
    for (const suggestion of fixtureCoachReply.suggestions) {
      for (const ref of suggestion.basedOn) {
        expect(evidence.has(ref)).toBe(true)
      }
    }
  })
})

describe('API contract: POST /checkin, GET /plan, POST /coach', () => {
  it('covers the three demo endpoints', () => {
    expect(apiContract.checkIn.method).toBe('POST')
    expect(apiContract.checkIn.path).toBe('/checkin')
    expect(apiContract.getPlan.method).toBe('GET')
    expect(apiContract.getPlan.path).toBe('/plan')
    expect(apiContract.coach.method).toBe('POST')
    expect(apiContract.coach.path).toBe('/coach')
  })

  it('POST /checkin: fixture request and success envelope validate', () => {
    expect(() => apiContract.checkIn.request.parse(fixtureCheckIn)).not.toThrow()
    const envelope = { success: true, data: fixtureEnergyResult }
    expect(CheckInResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('GET /plan: query and success envelope validate', () => {
    expect(PlanQuerySchema.parse({ date: '2026-07-21' })).toEqual({
      date: '2026-07-21',
    })
    expect(PlanQuerySchema.parse({})).toEqual({})
    const envelope = { success: true, data: fixtureDayPlan }
    expect(PlanResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('POST /coach: fixture request and success envelope validate', () => {
    expect(CoachRequestSchema.parse(fixtureCoachRequest)).toEqual(
      fixtureCoachRequest
    )
    const envelope = { success: true, data: fixtureCoachReply }
    expect(CoachResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('error envelope validates on every endpoint', () => {
    const envelope = { success: false, error: fixtureApiError }
    expect(CheckInResponseSchema.parse(envelope)).toEqual(envelope)
    expect(PlanResponseSchema.parse(envelope)).toEqual(envelope)
    expect(CoachResponseSchema.parse(envelope)).toEqual(envelope)
  })
})

describe('numeric ranges are enforced at runtime', () => {
  it('rejects mood outside 1–5', () => {
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, mood: 6 }).success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, mood: 0 }).success
    ).toBe(false)
  })

  it('rejects sleepHours off the 0.5 grid or above 14', () => {
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, sleepHours: 7.25 })
        .success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, sleepHours: 15 })
        .success
    ).toBe(false)
  })

  it('rejects score outside 0–100', () => {
    expect(
      EnergyResultSchema.safeParse({ ...fixtureEnergyResult, score: 101 })
        .success
    ).toBe(false)
    expect(
      EnergyResultSchema.safeParse({ ...fixtureEnergyResult, score: -1 })
        .success
    ).toBe(false)
  })

  it('rejects fractional scores and factor impacts', () => {
    expect(
      EnergyResultSchema.safeParse({ ...fixtureEnergyResult, score: 78.5 })
        .success
    ).toBe(false)
    const [firstFactor, ...restFactors] = fixtureEnergyResult.factors
    expect(
      EnergyResultSchema.safeParse({
        ...fixtureEnergyResult,
        factors: [{ ...firstFactor, impact: 14.5 }, ...restFactors],
      }).success
    ).toBe(false)
  })

  it('rejects malformed plan block times', () => {
    const [first, ...rest] = fixtureDayPlan.blocks
    const broken = {
      ...fixtureDayPlan,
      blocks: [{ ...first, start: '9:00' }, ...rest],
    }
    expect(DayPlanSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a plan block that does not end after it starts', () => {
    const [first, ...rest] = fixtureDayPlan.blocks
    const inverted = {
      ...fixtureDayPlan,
      blocks: [{ ...first, start: '10:00', end: '09:00' }, ...rest],
    }
    expect(DayPlanSchema.safeParse(inverted).success).toBe(false)
    const zeroLength = {
      ...fixtureDayPlan,
      blocks: [{ ...first, start: '08:00', end: '08:00' }, ...rest],
    }
    expect(DayPlanSchema.safeParse(zeroLength).success).toBe(false)
  })

  it('rejects an inverted peak window', () => {
    const broken = {
      ...fixtureEnergyResult,
      peakWindow: { startHour: 12, endHour: 9 },
    }
    expect(EnergyResultSchema.safeParse(broken).success).toBe(false)
  })
})
