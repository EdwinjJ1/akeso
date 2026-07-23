import type {
  ApiError,
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  HealthReport,
  HealthRecommendationSet,
  Task,
} from './schemas'
/**
 * Canonical demo fixtures (Issue #6). Entirely fictional — no real health
 * data. All modules (App UI, API seed data, AI prompt examples) use these
 * same values so the demo looks identical before and after integration.
 *
 * fixtureEnergyResult is genuine EnergyEngine output for fixtureCheckIn:
 * reportedEnergy 4/5 → score 80, impact +20 against the neutral 60 baseline.
 * packages/domain/src/fixtures.test.ts locks this file to the real engine.
 */

export const FIXTURE_DATE = '2026-07-21'

export const fixtureCheckIn: CheckInInput = {
  date: FIXTURE_DATE,
  reportedEnergy: 4,
  sleepDuration: '7_8h',
  lastMealTiming: '1_3h',
  hydration: '1_1_5l',
}

export const fixtureEnergyResult: EnergyResult = {
  date: FIXTURE_DATE,
  score: 80,
  band: 'high',
  headline: 'Strong day ahead — protect 10:00–12:00 for demanding work.',
  factors: [
    {
      key: 'reported_energy',
      label: 'Feeling good (4/5)',
      role: 'reported_energy',
      impact: 20,
      explanation: 'You reported your energy as 4/5 — that lifts today’s baseline by 20.',
    },
    {
      key: 'sleep_duration',
      label: '7–8h sleep',
      role: 'possible_context',
      explanation: 'Around a solid night — a likely support for today.',
    },
    {
      key: 'last_meal',
      label: 'Ate 1–3h ago',
      role: 'possible_context',
      explanation: 'Recent enough that fuel probably isn’t dragging you.',
    },
    {
      key: 'hydration',
      label: '1–1.5L water',
      role: 'possible_context',
      explanation: 'Making progress — keep sipping through the day.',
    },
  ],
  curve: [
    { hour: 7, level: 49 },
    { hour: 9, level: 85 },
    { hour: 11, level: 91 },
    { hour: 13, level: 78 },
    { hour: 15, level: 63 },
    { hour: 17, level: 73 },
    { hour: 19, level: 70 },
    { hour: 21, level: 55 },
  ],
  peakWindow: { startHour: 10, endHour: 12 },
  dipWindow: { startHour: 14, endHour: 16 },
  computedAt: `${FIXTURE_DATE}T00:00:00.000Z`,
}

export const fixtureTasks: Task[] = [
  {
    id: 'task-1',
    title: 'COMP2521 assignment — graph section',
    priority: 'must',
    energyDemand: 'high',
    estimatedMinutes: 120,
    status: 'scheduled',
  },
  {
    id: 'task-2',
    title: 'Internship cover letter draft',
    priority: 'must',
    energyDemand: 'high',
    estimatedMinutes: 60,
    status: 'scheduled',
  },
  {
    id: 'task-3',
    title: 'Reply to tutor + admin emails',
    priority: 'should',
    energyDemand: 'low',
    estimatedMinutes: 30,
    status: 'scheduled',
  },
  {
    id: 'task-4',
    title: 'Gym — light session',
    priority: 'should',
    energyDemand: 'medium',
    estimatedMinutes: 60,
    status: 'scheduled',
  },
  {
    id: 'task-5',
    title: 'Review lecture notes (week 8)',
    priority: 'could',
    energyDemand: 'medium',
    estimatedMinutes: 45,
    status: 'todo',
  },
]

export const fixtureDayPlan: DayPlan = {
  date: FIXTURE_DATE,
  blocks: [
    {
      id: 'block-1',
      start: '08:00',
      end: '08:45',
      type: 'meal',
      status: 'planned',
      source: 'akeso',
      title: 'Breakfast + slow start',
      energyLevel: 'moderate',
      rationale: 'Energy is still climbing — ease in before the peak.',
    },
    {
      id: 'block-2',
      start: '09:00',
      end: '11:00',
      type: 'focus',
      status: 'planned',
      source: 'akeso',
      title: 'COMP2521 assignment — graph section',
      taskId: 'task-1',
      energyLevel: 'high',
      rationale: 'Your hardest task lands in today’s 9–11:30 peak.',
    },
    {
      id: 'block-3',
      start: '11:00',
      end: '11:15',
      type: 'break',
      status: 'planned',
      source: 'akeso',
      title: 'Walk + water',
      energyLevel: 'high',
      rationale: 'Short movement break keeps the peak going.',
    },
    {
      id: 'block-4',
      start: '11:15',
      end: '12:15',
      type: 'focus',
      status: 'planned',
      source: 'akeso',
      title: 'Internship cover letter draft',
      taskId: 'task-2',
      energyLevel: 'high',
      rationale: 'Second demanding task while energy is still above 70.',
    },
    {
      id: 'block-5',
      start: '12:15',
      end: '13:00',
      type: 'meal',
      status: 'planned',
      source: 'akeso',
      title: 'Lunch — protein + iron focus',
      energyLevel: 'moderate',
      rationale: 'A heavy-carb lunch would deepen your 2–4pm dip.',
    },
    {
      id: 'block-6',
      start: '14:00',
      end: '14:30',
      type: 'light',
      status: 'planned',
      source: 'akeso',
      title: 'Emails + admin',
      taskId: 'task-3',
      energyLevel: 'low',
      rationale: 'Low-energy window — save it for low-demand work.',
    },
    {
      id: 'block-7',
      start: '14:30',
      end: '15:00',
      type: 'recovery',
      status: 'planned',
      source: 'akeso',
      title: 'Recovery break — no screens',
      energyLevel: 'low',
      rationale: 'Use the dip window for a low-pressure reset.',
    },
    {
      id: 'block-8',
      start: '17:00',
      end: '18:00',
      type: 'focus',
      status: 'planned',
      source: 'akeso',
      title: 'Gym — light session',
      taskId: 'task-4',
      energyLevel: 'moderate',
      rationale: 'Your evening rebound window suits movement.',
    },
  ],
  coachNote:
    'Today is front-loaded on purpose: your two hardest tasks sit near the late-morning peak, and the afternoon dip only carries admin and recovery.',
  generatedAt: `${FIXTURE_DATE}T08:05:10+10:00`,
}

export const fixtureCoachReply: CoachReply = {
  message:
    'Based on today’s check-in, you reported good energy. Sleep, a recent meal, and steady hydration are useful context, so the plan protects your late-morning window and keeps the afternoon flexible.',
  suggestions: [
    {
      id: 'sug-1',
      title: 'Keep water close this afternoon',
      detail:
        'You logged 1–1.5L so far. Consider having water with your next break as a general, low-risk support.',
      basedOn: ['hydration'],
    },
    {
      id: 'sug-2',
      title: 'Keep the 14:30 recovery break',
      detail:
        'The curve still has an afternoon dip, so a short no-screen break is a practical way to keep the rest of the plan lighter.',
      basedOn: ['block-7'],
    },
  ],
  disclaimer:
    'Akeso is an energy coach, not a medical device. Suggestions are based on your own check-ins, not clinical measurements.',
}

/**
 * A fictional confirmed report. Statuses are consistent with the bounds:
 * vitamin D 18 sits below its 30–100 range (low); hemoglobin 14.2 sits inside
 * 13.5–17.5 (normal); the ferritin metric has no upper bound on this report
 * so its status is `unknown` rather than invented.
 */
export const fixtureHealthReport: HealthReport = {
  id: 'report-1',
  createdAt: `${FIXTURE_DATE}T09:15:00+10:00`,
  metrics: [
    {
      id: 'vitamin-d',
      name: 'Vitamin D (25-OH)',
      value: 18,
      unit: 'ng/mL',
      referenceLow: 30,
      referenceHigh: 100,
      status: 'low',
    },
    {
      id: 'hemoglobin',
      name: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      referenceLow: 13.5,
      referenceHigh: 17.5,
      status: 'normal',
    },
    {
      id: 'ferritin',
      name: 'Ferritin',
      value: 42,
      unit: 'ng/mL',
      referenceLow: null,
      referenceHigh: null,
      status: 'unknown',
    },
  ],
}

export const fixtureHealthRecommendationSet: HealthRecommendationSet = {
  reportId: fixtureHealthReport.id,
  metrics: fixtureHealthReport.metrics,
  recommendations: [
    {
      id: 'rec-1',
      category: 'nutrition',
      title: 'Consider vitamin D–rich foods and daylight',
      detail:
        'Your report flagged vitamin D below its listed range. Regular daylight and foods like oily fish or fortified options are general, low-risk supports — a clinician can advise whether anything more is needed.',
      basedOnMetricIds: ['vitamin-d'],
    },
    {
      id: 'rec-2',
      category: 'follow_up',
      title: 'Discuss the full panel at your next visit',
      detail:
        'Some values sat outside or without a listed range. Bringing this report to a healthcare professional is the safe way to interpret what it means for you.',
      basedOnMetricIds: ['vitamin-d', 'ferritin'],
    },
  ],
  disclaimer:
    'Akeso is an energy coach, not a medical device. These are general lifestyle suggestions based on the values you confirmed — they do not diagnose any condition and are not a substitute for professional medical advice.',
}

export const fixtureApiError: ApiError = {
  code: 'VALIDATION_ERROR',
  message: 'reportedEnergy must be an integer between 1 and 5.',
}
