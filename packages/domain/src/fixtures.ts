import type {
  CoachReply,
  DayPlan,
  EnergyResult,
  FridgeItem,
  NutritionPlan,
  Task,
  UserProfile,
} from './types'

/**
 * Demo fixture data. Entirely fictional (see TEAM_CONTRACT §4.4) — no real
 * health data. The API team seeds the demo database with these same values
 * so the app looks identical before and after integration.
 */

export const FIXTURE_DATE = '2026-07-21'

export const fixtureProfile: UserProfile = {
  displayName: 'Alex',
  goal: 'academic',
  typicalWake: '07:30',
  typicalSleep: '23:30',
  dietaryPreference: 'none',
}

export const fixtureEnergyResult: EnergyResult = {
  date: FIXTURE_DATE,
  score: 72,
  band: 'high',
  headline: 'Solid morning ahead — protect 9:00–11:30 for deep work.',
  factors: [
    {
      key: 'sleep_duration',
      label: '7.5h sleep',
      impact: 14,
      explanation: 'Close to your 8h target — your biggest energy source today.',
    },
    {
      key: 'sleep_quality',
      label: 'Good sleep quality',
      impact: 6,
      explanation: 'You rated sleep 4/5, which lifts your morning peak.',
    },
    {
      key: 'mood',
      label: 'Positive mood',
      impact: 5,
      explanation: 'Mood 4/5 usually adds steady energy across the day.',
    },
    {
      key: 'stress',
      label: 'Elevated stress',
      impact: -8,
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
    { hour: 6, level: 35 },
    { hour: 7, level: 48 },
    { hour: 8, level: 62 },
    { hour: 9, level: 78 },
    { hour: 10, level: 84 },
    { hour: 11, level: 80 },
    { hour: 12, level: 68 },
    { hour: 13, level: 55 },
    { hour: 14, level: 44 },
    { hour: 15, level: 40 },
    { hour: 16, level: 50 },
    { hour: 17, level: 60 },
    { hour: 18, level: 64 },
    { hour: 19, level: 58 },
    { hour: 20, level: 50 },
    { hour: 21, level: 40 },
    { hour: 22, level: 30 },
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
      rationale: 'Your hardest task lands in today’s 9–11:30 peak.',
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
    'Today is front-loaded on purpose: your two hardest tasks sit inside the 9:00–11:30 peak, and the 2–4pm dip only carries admin and recovery.',
  generatedAt: `${FIXTURE_DATE}T08:05:10+10:00`,
}

export const fixtureCoachReply: CoachReply = {
  message:
    'Based on today’s check-in, your morning is your strongest window. The plan protects 9:00–11:30 for the assignment and keeps the afternoon light because stress is elevated.',
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

export const fixtureFridge: FridgeItem[] = [
  { id: 'fridge-1', name: 'Eggs', category: 'protein' },
  { id: 'fridge-2', name: 'Spinach', category: 'vegetable' },
  { id: 'fridge-3', name: 'Salmon fillet', category: 'protein' },
  { id: 'fridge-4', name: 'Greek yogurt', category: 'dairy' },
  { id: 'fridge-5', name: 'Oats', category: 'grain' },
  { id: 'fridge-6', name: 'Blueberries', category: 'fruit' },
  { id: 'fridge-7', name: 'Brown rice', category: 'grain' },
  { id: 'fridge-8', name: 'Capsicum', category: 'vegetable' },
]

export const fixtureNutritionPlan: NutritionPlan = {
  date: FIXTURE_DATE,
  needs: [
    {
      key: 'protein',
      label: 'Protein',
      current: 38,
      target: 90,
      unit: 'g',
      note: 'Supports steady energy through the afternoon.',
    },
    {
      key: 'iron',
      label: 'Iron',
      current: 6,
      target: 12,
      unit: 'mg',
      note: 'Low iron is a common driver of afternoon dips.',
    },
    {
      key: 'complex_carbs',
      label: 'Complex carbs',
      current: 95,
      target: 180,
      unit: 'g',
      note: 'Slow carbs at lunch flatten the 2–4pm crash.',
    },
    {
      key: 'hydration',
      label: 'Water',
      current: 1.1,
      target: 2.5,
      unit: 'L',
      note: 'Even mild dehydration reads as fatigue.',
    },
  ],
  fridge: fixtureFridge,
  meals: [
    {
      id: 'meal-1',
      slot: 'breakfast',
      title: 'Blueberry yogurt oats',
      description:
        'Oats + Greek yogurt + blueberries. Slow carbs and protein to extend your morning peak.',
      usesFridgeItemIds: ['fridge-4', 'fridge-5', 'fridge-6'],
      boosts: ['protein', 'complex_carbs'],
      prepMinutes: 5,
      tags: ['pre-focus', '5 min'],
    },
    {
      id: 'meal-2',
      slot: 'lunch',
      title: 'Salmon, rice & spinach bowl',
      description:
        'Salmon + brown rice + spinach + capsicum. Iron and omega-3 aimed straight at your 2–4pm dip.',
      usesFridgeItemIds: ['fridge-3', 'fridge-7', 'fridge-2', 'fridge-8'],
      boosts: ['iron', 'omega3', 'protein'],
      prepMinutes: 20,
      tags: ['anti-dip', 'high-iron'],
    },
    {
      id: 'meal-3',
      slot: 'snack',
      title: '3pm spinach & egg wrap',
      description:
        'Instead of the afternoon coffee — protein and iron without the sleep cost.',
      usesFridgeItemIds: ['fridge-1', 'fridge-2'],
      boosts: ['protein', 'iron'],
      prepMinutes: 10,
      tags: ['coffee swap', 'dip window'],
    },
  ],
  rationale:
    'Your check-in shows elevated stress and an afternoon coffee habit. Today’s meals push iron and protein into lunch and replace the 3pm coffee, which is the cheapest way to soften your 2–4pm dip.',
}
