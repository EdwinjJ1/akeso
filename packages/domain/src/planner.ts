import type {
  DayPlan,
  EnergyBand,
  EnergyResult,
  PlanBlock,
  PlanBlockType,
  Task,
  UpdatePlanBlockInput,
} from './types'

const PRIORITY_RANK: Record<Task['priority'], number> = {
  must: 0,
  should: 1,
  could: 2,
}

const DEMAND_RANK: Record<Task['energyDemand'], number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const LUNCH_START_MINUTES = 12 * 60
const LUNCH_DURATION_MINUTES = 45
const EVENING_BLOCK_MINUTES = 60

export class PlanBlockNotFoundError extends Error {
  constructor(blockId: string) {
    super(`Plan block ${blockId} was not found`)
    this.name = 'PlanBlockNotFoundError'
  }
}

export class PlanBlockOverlapError extends Error {
  constructor(public readonly conflictingBlockId: string) {
    super(`Updated time overlaps plan block ${conflictingBlockId}`)
    this.name = 'PlanBlockOverlapError'
  }
}

const blocksOverlap = (
  left: Pick<PlanBlock, 'start' | 'end'>,
  right: Pick<PlanBlock, 'start' | 'end'>
) => left.start < right.end && right.start < left.end

export function updatePlanBlock(
  plan: DayPlan,
  blockId: string,
  input: UpdatePlanBlockInput
): DayPlan {
  const current = plan.blocks.find((block) => block.id === blockId)
  if (!current) throw new PlanBlockNotFoundError(blockId)

  const conflicting = plan.blocks.find(
    (block) => block.id !== blockId && blocksOverlap(input, block)
  )
  if (conflicting) throw new PlanBlockOverlapError(conflicting.id)

  const originalSuggestion =
    current.source === 'user'
      ? current.originalSuggestion
      : { title: current.title, start: current.start, end: current.end }
  const updated: PlanBlock = {
    ...current,
    ...input,
    source: 'user',
    originalSuggestion,
  }

  return {
    ...plan,
    blocks: plan.blocks
      .map((block) => (block.id === blockId ? updated : block))
      .sort((left, right) => left.start.localeCompare(right.start)),
  }
}

export function mergeRegeneratedPlan(fresh: DayPlan, current: DayPlan): DayPlan {
  const userBlocks = current.blocks.filter(
    (block): block is Extract<PlanBlock, { source: 'user' }> =>
      block.source === 'user'
  )
  if (userBlocks.length === 0) return fresh

  const generatedBlocks = fresh.blocks.filter(
    (candidate) =>
      !userBlocks.some(
        (userBlock) =>
          candidate.id === userBlock.id ||
          (candidate.taskId !== undefined &&
            candidate.taskId === userBlock.taskId) ||
          (candidate.type === userBlock.type &&
            candidate.title === userBlock.originalSuggestion.title &&
            candidate.start === userBlock.originalSuggestion.start &&
            candidate.end === userBlock.originalSuggestion.end) ||
          blocksOverlap(candidate, userBlock)
      )
  )

  return {
    ...fresh,
    blocks: [...generatedBlocks, ...userBlocks].sort((left, right) =>
      left.start.localeCompare(right.start)
    ),
  }
}

function toHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)))
  const hour = Math.floor(clamped / 60)
  const minute = clamped % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function bandAt(energy: EnergyResult, hour: number): EnergyBand {
  const point = energy.curve.reduce((closest, candidate) =>
    Math.abs(candidate.hour - hour) < Math.abs(closest.hour - hour)
      ? candidate
      : closest
  )
  if (point.level >= 70) return 'high'
  if (point.level >= 40) return 'moderate'
  return 'low'
}

function byPlanOrder(a: Task, b: Task): number {
  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (priorityDiff !== 0) return priorityDiff
  return DEMAND_RANK[a.energyDemand] - DEMAND_RANK[b.energyDemand]
}

/**
 * Consumes tasks from `pending` (highest priority / energy demand first)
 * into sequential blocks that fit inside [windowStart, windowEnd) minutes.
 * Mutates `pending` by removing whatever it schedules.
 */
function fillWindow(
  pending: Task[],
  windowStart: number,
  windowEnd: number,
  blockType: PlanBlockType,
  energy: EnergyResult,
  rationale: (task: Task) => string,
  blocks: PlanBlock[],
  nextId: () => string,
  demandFilter: (demand: Task['energyDemand']) => boolean
): number {
  let cursor = windowStart
  while (cursor < windowEnd) {
    const index = pending.findIndex((task) => demandFilter(task.energyDemand))
    if (index === -1) break
    const [task] = pending.splice(index, 1)
    const duration = Math.min(task.estimatedMinutes, windowEnd - cursor)
    if (duration < 15) {
      pending.unshift(task)
      break
    }
    const start = cursor
    const end = cursor + duration
    blocks.push({
      id: nextId(),
      start: toHHMM(start),
      end: toHHMM(end),
      type: blockType,
      status: 'planned',
      source: 'akeso',
      title: task.title,
      taskId: task.id,
      energyLevel: bandAt(energy, Math.floor(start / 60)),
      rationale: rationale(task),
    })
    cursor = end
  }
  return cursor
}

/**
 * Pure, deterministic day planner. Same EnergyResult + tasks always produce
 * the same DayPlan — no LLM, no randomness, no IO. Given the same demand
 * inputs the API layer only ever needs to persist the output.
 */
export function planDay(energy: EnergyResult, tasks: Task[]): DayPlan {
  const pending = tasks
    .filter((task) => task.status !== 'done')
    .slice()
    .sort(byPlanOrder)

  const blocks: PlanBlock[] = []
  let blockCount = 0
  const nextId = () => `block-${++blockCount}`

  const peakStart = energy.peakWindow.startHour * 60
  const peakEnd = energy.peakWindow.endHour * 60
  const dipStart = energy.dipWindow.startHour * 60
  const dipEnd = energy.dipWindow.endHour * 60

  if (energy.peakWindow.startHour > 6) {
    blocks.push({
      id: nextId(),
      start: toHHMM(peakStart - 60),
      end: toHHMM(peakStart),
      type: 'light',
      status: 'planned',
      source: 'akeso',
      title: 'Ease into the day',
      energyLevel: bandAt(energy, energy.peakWindow.startHour - 1),
      rationale: 'Energy is still climbing toward today’s peak — start light.',
    })
  }

  const peakCursor = fillWindow(
    pending,
    peakStart,
    peakEnd,
    'focus',
    energy,
    (task) =>
      `Scheduled inside today's ${toHHMM(peakStart)}–${toHHMM(peakEnd)} peak window because it is a ${task.priority}-priority, ${task.energyDemand}-demand task.`,
    blocks,
    nextId,
    (demand) => demand !== 'low'
  )

  const lunchStart = Math.max(peakCursor, LUNCH_START_MINUTES)
  const lunchEnd = lunchStart + LUNCH_DURATION_MINUTES
  blocks.push({
    id: nextId(),
    start: toHHMM(lunchStart),
    end: toHHMM(lunchEnd),
    type: 'meal',
    status: 'planned',
    source: 'akeso',
    title: 'Lunch',
    energyLevel: bandAt(energy, Math.floor(lunchStart / 60)),
    rationale: 'A fixed meal break protects the transition out of the peak window.',
  })

  const dipWindowStart = Math.max(lunchEnd, dipStart)
  const dipCursor = fillWindow(
    pending,
    dipWindowStart,
    dipEnd,
    'light',
    energy,
    (task) =>
      `Placed in today's ${toHHMM(dipStart)}–${toHHMM(dipEnd)} dip window because low-demand work is a better fit here.`,
    blocks,
    nextId,
    (demand) => demand === 'low'
  )

  if (dipCursor < dipEnd) {
    blocks.push({
      id: nextId(),
      start: toHHMM(dipCursor),
      end: toHHMM(dipEnd),
      type: 'recovery',
      status: 'planned',
      source: 'akeso',
      title: 'Recovery break — no screens',
      energyLevel: 'low',
      rationale: `Today's dip window (${toHHMM(dipStart)}–${toHHMM(dipEnd)}) has no light tasks queued, so this stays protected recovery time.`,
    })
  }

  const eveningStart = Math.max(dipEnd, dipCursor)
  const remaining = pending.find((task) => task.energyDemand !== 'high')
  if (remaining) {
    pending.splice(pending.indexOf(remaining), 1)
    blocks.push({
      id: nextId(),
      start: toHHMM(eveningStart),
      end: toHHMM(eveningStart + EVENING_BLOCK_MINUTES),
      type: remaining.energyDemand === 'medium' ? 'focus' : 'light',
      status: 'planned',
      source: 'akeso',
      title: remaining.title,
      taskId: remaining.id,
      energyLevel: bandAt(energy, Math.floor(eveningStart / 60)),
      rationale: `Energy typically rebounds by evening, enough for this ${remaining.energyDemand}-demand task.`,
    })
  }

  const coachNote =
    energy.band === 'high'
      ? `Today is front-loaded on purpose: your hardest tasks sit inside the ${toHHMM(peakStart)}–${toHHMM(peakEnd)} peak, and the ${toHHMM(dipStart)}–${toHHMM(dipEnd)} dip stays light.`
      : energy.band === 'moderate'
        ? `One important task is protected inside the ${toHHMM(peakStart)}–${toHHMM(peakEnd)} window; everything else is kept light around it.`
        : `Today is deliberately light — the plan leans on the ${toHHMM(peakStart)}–${toHHMM(peakEnd)} window for one small win and protects recovery through the ${toHHMM(dipStart)}–${toHHMM(dipEnd)} dip.`

  return {
    date: energy.date,
    blocks,
    coachNote,
    generatedAt: new Date().toISOString(),
  }
}
