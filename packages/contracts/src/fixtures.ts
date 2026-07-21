import type {
  ApiError,
  CheckInInput,
  CoachReply,
  DayPlan,
  EnergyResult,
  Task,
} from './schemas'
import type { CoachRequest } from './api'

/**
 * Canonical demo fixtures (Issue #6). Entirely fictional — no real health
 * data. All modules (App UI, API seed data, AI prompt examples) use these
 * same values so the demo looks identical before and after integration.
 *
 * Factor impacts are demo values relative to a neutral 50 baseline:
 * 50 + 15 + 7 + 5 + 10 − 6 − 3 = 78.
 */

export const FIXTURE_DATE = '2026-07-21'

export const fixtureCheckIn: CheckInInput = {
  date: FIXTURE_DATE,
  sleepHours: 7.5,
  sleepQuality: 4,
  mood: 4,
  stress: 4,
  energyNow: 4,
  caffeine: 'afternoon',
  notes: 'Big assignment due Friday.',
}

export const fixtureEnergyResult: EnergyResult = {
  date: FIXTURE_DATE,
  score: 78,
  band: 'high',
  headline: 'Solid morning ahead — protect 9:00–12:00 for deep work.',
  factors: [
    {
      key: 'sleep_duration',
      label: '7.5h sleep',
      impact: 15,
      explanation: 'Close to your 8h target — your biggest energy source today.',
    },
    {
      key: 'sleep_quality',
      label: 'Good sleep quality',
      impact: 7,
      explanation: 'You rated sleep 4/5, which lifts your morning peak.',
    },
    {
      key: 'mood',
      label: 'Positive mood',
      impact: 5,
      explanation: 'Mood 4/5 usually adds steady energy across the day.',
    },
    {
      key: 'self_report',
      label: 'Feeling energetic',
      impact: 10,
      explanation: 'You already feel 4/5 right now, which raises the whole curve.',
    },
    {
      key: 'stress',
      label: 'Elevated stress',
      impact: -6,
      explanation: 'Stress 4/5 tends to deepen your afternoon dip.',
    },
    {
      key: 'caffeine',
      label: 'Afternoon coffee',
      impact: -3,
      explanation: 'Caffeine after 2pm can push tonight’s sleep later.',
    },
  ],
  curve: [
    { hour: 6, level: 38 },
    { hour: 7, level: 52 },
    { hour: 8, level: 66 },
    { hour: 9, level: 82 },
    { hour: 10, level: 88 },
    { hour: 11, level: 84 },
    { hour: 12, level: 72 },
    { hour: 13, level: 58 },
    { hour: 14, level: 46 },
    { hour: 15, level: 42 },
    { hour: 16, level: 52 },
    { hour: 17, level: 63 },
    { hour: 18, level: 67 },
    { hour: 19, level: 60 },
    { hour: 20, level: 52 },
    { hour: 21, level: 42 },
    { hour: 22, level: 32 },
  ],
  peakWindow: { startHour: 9, endHour: 12 },
  dipWindow: { startHour: 14, endHour: 16 },
  computedAt: `${FIXTURE_DATE}T08:05:00+10:00`,
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
      title: 'Breakfast + slow start',
      energyLevel: 'moderate',
      rationale: 'Energy is still climbing — ease in before the peak.',
    },
    {
      id: 'block-2',
      start: '09:00',
      end: '11:00',
      type: 'focus',
      title: 'COMP2521 assignment — graph section',
      taskId: 'task-1',
      energyLevel: 'high',
      rationale: 'Your hardest task lands in today’s 9–12 peak.',
    },
    {
      id: 'block-3',
      start: '11:00',
      end: '11:15',
      type: 'break',
      title: 'Walk + water',
      energyLevel: 'high',
      rationale: 'Short movement break keeps the peak going.',
    },
    {
      id: 'block-4',
      start: '11:15',
      end: '12:15',
      type: 'focus',
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
      title: 'Lunch — protein + iron focus',
      energyLevel: 'moderate',
      rationale: 'A heavy-carb lunch would deepen your 2–4pm dip.',
    },
    {
      id: 'block-6',
      start: '14:00',
      end: '14:30',
      type: 'light',
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
      title: 'Recovery break — no screens',
      energyLevel: 'low',
      rationale: 'Stress is 4/5 today; a real break blunts the dip.',
    },
    {
      id: 'block-8',
      start: '17:00',
      end: '18:00',
      type: 'focus',
      title: 'Gym — light session',
      taskId: 'task-4',
      energyLevel: 'moderate',
      rationale: 'Your evening rebound window suits movement.',
    },
  ],
  coachNote:
    'Today is front-loaded on purpose: your two hardest tasks sit inside the 9:00–12:00 peak, and the 2–4pm dip only carries admin and recovery.',
  generatedAt: `${FIXTURE_DATE}T08:05:10+10:00`,
}

export const fixtureCoachRequest: CoachRequest = {
  message: 'I always crash after lunch — what should I change today?',
  date: FIXTURE_DATE,
}

export const fixtureCoachReply: CoachReply = {
  message:
    'Based on today’s check-in, your morning is your strongest window. The plan protects 9:00–12:00 for the assignment and keeps the afternoon light because stress is elevated.',
  suggestions: [
    {
      id: 'sug-1',
      title: 'Skip the afternoon coffee',
      detail:
        'Caffeine after 2pm is costing you roughly 3 points and pushes sleep later. Try a 10-minute walk at 3pm instead.',
      basedOn: ['caffeine', 'sleep_duration'],
    },
    {
      id: 'sug-2',
      title: 'Keep the 14:30 recovery break',
      detail:
        'With stress at 4/5, the no-screen break is what keeps your 5pm rebound available for the gym.',
      basedOn: ['stress', 'block-7'],
    },
  ],
  disclaimer:
    'Akeso is an energy coach, not a medical device. Suggestions are based on your own check-ins, not clinical measurements.',
}

export const fixtureApiError: ApiError = {
  code: 'VALIDATION_ERROR',
  message: 'mood must be an integer between 1 and 5.',
}
