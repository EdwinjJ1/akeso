import { describe, expect, it } from 'vitest'
import {
  apiContract,
  CheckInResponseSchema,
  DateParamsSchema,
  GetCoachResponseSchema,
  GetEnergyResponseSchema,
  GetNutritionResponseSchema,
  GetPlanResponseSchema,
  GetProfileResponseSchema,
  PutProfileRequestSchema,
  PutProfileResponseSchema,
  RegeneratePlanBodySchema,
  RegeneratePlanResponseSchema,
  TasksQuerySchema,
  UpdatePlanBlockParamsSchema,
  UpdatePlanBlockRequestSchema,
  UpdatePlanBlockResponseSchema,
} from './api'
import {
  fixtureApiError,
  fixtureCheckIn,
  fixtureCoachReply,
  fixtureDayPlan,
  fixtureEnergyResult,
  fixtureTasks,
} from './fixtures'
import {
  CheckInInputSchema,
  CoachReplySchema,
  DayPlanSchema,
  EnergyResultSchema,
  PlanBlockSchema,
  TaskSchema,
  UpdatePlanBlockInputSchema,
} from './schemas'
import type { EnergyFactor } from './schemas'

const isReportedFactor = (
  factor: EnergyFactor
): factor is Extract<EnergyFactor, { role: 'reported_energy' }> =>
  factor.role === 'reported_energy'

const isContextFactor = (
  factor: EnergyFactor
): factor is Extract<EnergyFactor, { role: 'possible_context' }> =>
  factor.role === 'possible_context'

describe('fixtures satisfy the frozen schemas', () => {
  it('CheckInInput', () => {
    expect(CheckInInputSchema.parse(fixtureCheckIn)).toEqual(fixtureCheckIn)
  })

  it('EnergyResult with score 80', () => {
    const parsed = EnergyResultSchema.parse(fixtureEnergyResult)
    expect(parsed.score).toBe(80)
    expect(parsed.factors).toHaveLength(4)
    expect(parsed.curve.length).toBeGreaterThanOrEqual(2)
  })

  it('only the reported_energy factor carries an impact', () => {
    for (const factor of fixtureEnergyResult.factors) {
      if (factor.role === 'reported_energy') {
        expect(factor.impact).toBeTypeOf('number')
      } else {
        expect(factor.role).toBe('possible_context')
        expect('impact' in factor).toBe(false)
      }
    }
  })

  it('rejects factor attribution that disagrees with the role', () => {
    const reportedFactor = fixtureEnergyResult.factors.find(isReportedFactor)
    const contextFactor = fixtureEnergyResult.factors.find(isContextFactor)
    expect(reportedFactor).toBeDefined()
    expect(contextFactor).toBeDefined()
    if (!reportedFactor || !contextFactor) throw new Error('Fixture factors are incomplete')

    const restFactors = fixtureEnergyResult.factors.filter(
      (factor) => factor !== reportedFactor && factor !== contextFactor
    )
    const { impact: _impact, ...reportedWithoutImpact } = reportedFactor

    expect(
      EnergyResultSchema.safeParse({
        ...fixtureEnergyResult,
        factors: [reportedWithoutImpact, contextFactor, ...restFactors],
      }).success
    ).toBe(false)

    expect(
      EnergyResultSchema.safeParse({
        ...fixtureEnergyResult,
        factors: [reportedFactor, { ...contextFactor, impact: -10 }, ...restFactors],
      }).success
    ).toBe(false)

    expect(
      EnergyResultSchema.safeParse({
        ...fixtureEnergyResult,
        factors: [
          { ...reportedFactor, key: 'sleep_duration' },
          contextFactor,
          ...restFactors,
        ],
      }).success
    ).toBe(false)
  })

  it('every Task', () => {
    for (const task of fixtureTasks) {
      expect(TaskSchema.parse(task)).toEqual(task)
    }
  })

  it('DayPlan', () => {
    expect(DayPlanSchema.parse(fixtureDayPlan)).toEqual(fixtureDayPlan)
  })

  it('marks generated plan blocks as pending Akeso suggestions', () => {
    expect(
      fixtureDayPlan.blocks.every(
        (block) => block.source === 'akeso' && block.status === 'planned'
      )
    ).toBe(true)
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

describe('API contract: route map matches the implemented /v1 API', () => {
  it('covers all ten implemented endpoints', () => {
    expect(
      Object.values(apiContract).map((endpoint) => `${endpoint.method} ${endpoint.path}`)
    ).toEqual([
      'GET /v1/profile',
      'PUT /v1/profile',
      'POST /v1/checkins',
      'GET /v1/energy/:date',
      'GET /v1/tasks',
      'GET /v1/plan/:date',
      'PATCH /v1/plan/:date/blocks/:blockId',
      'POST /v1/plan/:date/regenerate',
      'GET /v1/nutrition/:date',
      'GET /v1/coach/:date',
    ])
  })

  it('POST /v1/checkins: fixture request and success envelope validate', () => {
    expect(() =>
      apiContract.submitCheckIn.request.parse(fixtureCheckIn)
    ).not.toThrow()
    const envelope = { success: true, data: fixtureEnergyResult }
    expect(CheckInResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('PUT /v1/profile: profile round-trips through request and response', () => {
    const profile = {
      displayName: 'Alex',
      goal: 'academic',
      typicalWake: '07:30',
      typicalSleep: '23:30',
      dietaryPreference: 'none',
    }
    expect(PutProfileRequestSchema.parse(profile)).toEqual(profile)
    const envelope = { success: true, data: profile }
    expect(PutProfileResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('date-scoped routes accept only real calendar dates', () => {
    expect(DateParamsSchema.safeParse({ date: '2026-07-21' }).success).toBe(true)
    expect(DateParamsSchema.safeParse({ date: '2026-13-45' }).success).toBe(false)
    expect(TasksQuerySchema.safeParse({ date: '2026-07-21' }).success).toBe(true)
    expect(TasksQuerySchema.safeParse({}).success).toBe(false)
  })

  it('nullable GETs allow data: null (HTTP 200) before any check-in', () => {
    const nullEnvelope = { success: true, data: null }
    expect(GetProfileResponseSchema.parse(nullEnvelope)).toEqual(nullEnvelope)
    expect(GetEnergyResponseSchema.parse(nullEnvelope)).toEqual(nullEnvelope)
    expect(GetPlanResponseSchema.parse(nullEnvelope)).toEqual(nullEnvelope)
    expect(GetNutritionResponseSchema.parse(nullEnvelope)).toEqual(nullEnvelope)
  })

  it('GET /v1/plan/:date and /v1/coach/:date success envelopes validate', () => {
    const planEnvelope = { success: true, data: fixtureDayPlan }
    expect(GetPlanResponseSchema.parse(planEnvelope)).toEqual(planEnvelope)
    const coachEnvelope = { success: true, data: fixtureCoachReply }
    expect(GetCoachResponseSchema.parse(coachEnvelope)).toEqual(coachEnvelope)
  })

  it('POST /v1/plan/:date/regenerate: optional instruction, plan+coach bundle', () => {
    expect(RegeneratePlanBodySchema.safeParse({}).success).toBe(true)
    expect(
      RegeneratePlanBodySchema.safeParse({ instruction: 'more recovery' }).success
    ).toBe(true)
    expect(
      RegeneratePlanBodySchema.safeParse({ instruction: 'x'.repeat(281) }).success
    ).toBe(false)
    const envelope = {
      success: true,
      data: { plan: fixtureDayPlan, coach: fixtureCoachReply },
    }
    expect(RegeneratePlanResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('PATCH /v1/plan/:date/blocks/:blockId accepts only editable fields', () => {
    expect(
      UpdatePlanBlockParamsSchema.parse({
        date: fixtureDayPlan.date,
        blockId: fixtureDayPlan.blocks[0].id,
      })
    ).toEqual({
      date: fixtureDayPlan.date,
      blockId: fixtureDayPlan.blocks[0].id,
    })
    expect(
      UpdatePlanBlockRequestSchema.parse({
        title: 'Updated breakfast',
        start: '08:15',
        end: '08:45',
        status: 'completed',
      })
    ).toEqual({
      title: 'Updated breakfast',
      start: '08:15',
      end: '08:45',
      status: 'completed',
    })
    const envelope = { success: true, data: fixtureDayPlan }
    expect(UpdatePlanBlockResponseSchema.parse(envelope)).toEqual(envelope)
  })

  it('error envelope validates on every endpoint', () => {
    const envelope = { success: false, error: fixtureApiError }
    for (const endpoint of Object.values(apiContract)) {
      expect(endpoint.response.parse(envelope)).toEqual(envelope)
    }
  })
})

describe('numeric ranges are enforced at runtime', () => {
  it('accepts an empty suggestion list as a valid empty Plan', () => {
    expect(
      DayPlanSchema.safeParse({ ...fixtureDayPlan, blocks: [] }).success
    ).toBe(true)
  })

  it('requires a user-updated block to retain its original suggestion', () => {
    const block = fixtureDayPlan.blocks[0]
    expect(
      PlanBlockSchema.safeParse({
        ...block,
        source: 'user',
        title: 'Updated breakfast',
      }).success
    ).toBe(false)

    expect(
      PlanBlockSchema.safeParse({
        ...block,
        source: 'user',
        title: 'Updated breakfast',
        originalSuggestion: {
          title: block.title,
          start: block.start,
          end: block.end,
        },
      }).success
    ).toBe(true)
  })

  it('accepts only the four user-editable plan block fields', () => {
    expect(
      UpdatePlanBlockInputSchema.parse({
        title: 'Write project outline',
        start: '09:30',
        end: '10:45',
        status: 'completed',
      })
    ).toEqual({
      title: 'Write project outline',
      start: '09:30',
      end: '10:45',
      status: 'completed',
    })

    expect(
      UpdatePlanBlockInputSchema.safeParse({
        title: 'Write project outline',
        start: '09:30',
        end: '10:45',
        status: 'planned',
        energyLevel: 'high',
      }).success
    ).toBe(false)
  })

  it('rejects reportedEnergy outside 1–5', () => {
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, reportedEnergy: 6 })
        .success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, reportedEnergy: 0 })
        .success
    ).toBe(false)
  })

  it('rejects lastMealDescription longer than 280 chars (matches server enforcement)', () => {
    expect(
      CheckInInputSchema.safeParse({
        ...fixtureCheckIn,
        lastMealDescription: 'x'.repeat(281),
      }).success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({
        ...fixtureCheckIn,
        lastMealDescription: 'x'.repeat(280),
      }).success
    ).toBe(true)
  })

  it('rejects unknown context buckets', () => {
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, sleepDuration: '9h' })
        .success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({
        ...fixtureCheckIn,
        lastMealTiming: 'yesterday',
      }).success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, hydration: 'lots' })
        .success
    ).toBe(false)
  })

  it('rejects leftover legacy fields instead of silently dropping them', () => {
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, sleepHours: 7.5 })
        .success
    ).toBe(false)
    expect(
      CheckInInputSchema.safeParse({ ...fixtureCheckIn, caffeine: 'morning' })
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
