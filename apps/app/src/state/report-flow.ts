import {
  computeMetricStatus,
  type ReportExtractionResult,
  type ReportMetric,
  type ReportMetricStatus,
} from '@akeso/domain'

/**
 * A metric candidate under review. Mirrors the fridge confirmation flow: AI
 * candidates start unconfirmed and nothing is persisted until the user
 * confirms. `status` is always derived from the (report-provided) bounds so
 * the UI shows the same value the server will recompute — never a guess.
 */
export interface ReportMetricCandidate {
  localId: string
  /** Stable server id once saved; null for a new extraction/manual row. */
  persistedId: string | null
  name: string
  value: number
  unit: string
  referenceLow: number | null
  referenceHigh: number | null
  confidence: number | null
  uncertaintyReason: string | null
  confirmed: boolean
}

export interface ReportMetricEdit {
  name: string
  value: number
  unit: string
  referenceLow: number | null
  referenceHigh: number | null
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ')
const normalizedName = (name: string) => cleanName(name).toLocaleLowerCase()
const nextLocalId = (prefix: string, index: number) => `${prefix}-${index + 1}`

const nextAvailableLocalId = (
  candidates: ReportMetricCandidate[],
  prefix: string
) => {
  const ids = new Set(candidates.map((candidate) => candidate.localId))
  let index = 1
  while (ids.has(`${prefix}-${index}`)) index += 1
  return `${prefix}-${index}`
}

export function candidateStatus(
  candidate: ReportMetricCandidate
): ReportMetricStatus {
  if (
    !Number.isFinite(candidate.value) ||
    (candidate.referenceLow !== null &&
      !Number.isFinite(candidate.referenceLow)) ||
    (candidate.referenceHigh !== null &&
      !Number.isFinite(candidate.referenceHigh))
  ) {
    return 'unknown'
  }
  return computeMetricStatus(
    candidate.value,
    candidate.referenceLow,
    candidate.referenceHigh
  )
}

/** Blank or malformed required numeric input stays invalid instead of
 * silently becoming zero (`Number('') === 0`). */
export function parseRequiredMetricNumber(text: string): number {
  if (text.trim() === '') return Number.NaN
  const value = Number(text)
  return Number.isFinite(value) ? value : Number.NaN
}

export function hasInvalidConfirmedCandidates(
  candidates: ReportMetricCandidate[]
): boolean {
  return candidates.some(
    (candidate) =>
      candidate.confirmed &&
      (!cleanName(candidate.name) || !Number.isFinite(candidate.value))
  )
}

/** Every saved row, including an unconfirmed one, must remain structurally
 * valid so it can be shown and corrected on the detail screen later. */
export function hasInvalidReportCandidates(
  candidates: ReportMetricCandidate[]
): boolean {
  return candidates.some(
    (candidate) =>
      !cleanName(candidate.name) ||
      !Number.isFinite(candidate.value) ||
      (candidate.referenceLow !== null &&
        !Number.isFinite(candidate.referenceLow)) ||
      (candidate.referenceHigh !== null &&
        !Number.isFinite(candidate.referenceHigh)) ||
      (candidate.referenceLow !== null &&
        candidate.referenceHigh !== null &&
        candidate.referenceLow > candidate.referenceHigh)
  )
}

export function hasDuplicateReportCandidates(
  candidates: ReportMetricCandidate[]
): boolean {
  const names = new Set<string>()
  for (const candidate of candidates) {
    const name = normalizedName(candidate.name)
    if (name && names.has(name)) return true
    if (name) names.add(name)
  }
  return false
}

export function candidatesFromExtraction(
  result: ReportExtractionResult
): ReportMetricCandidate[] {
  if (result.status !== 'ok') return []
  return result.metrics.map((metric, index) => ({
    localId: nextLocalId('extracted', index),
    persistedId: null,
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
    referenceLow: metric.referenceLow,
    referenceHigh: metric.referenceHigh,
    confidence: metric.confidence,
    uncertaintyReason: metric.uncertaintyReason,
    confirmed: false,
  }))
}

/** Rehydrate every saved recognition result, including unconfirmed fields. */
export function candidatesFromReportMetrics(
  metrics: ReportMetric[]
): ReportMetricCandidate[] {
  return metrics.map((metric, index) => ({
    localId: nextLocalId('saved', index),
    persistedId: metric.id,
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
    referenceLow: metric.referenceLow,
    referenceHigh: metric.referenceHigh,
    confidence: metric.confidence,
    uncertaintyReason: metric.uncertaintyReason,
    confirmed: metric.confirmed,
  }))
}

export function editMetricCandidate(
  candidates: ReportMetricCandidate[],
  localId: string,
  patch: ReportMetricEdit
): ReportMetricCandidate[] {
  return candidates.map((candidate) =>
    candidate.localId === localId
      ? (() => {
          const edited = {
            name: cleanName(patch.name),
            value: patch.value,
            unit: patch.unit.trim(),
            referenceLow: patch.referenceLow,
            referenceHigh: patch.referenceHigh,
          }
          const changed =
            edited.name !== candidate.name ||
            !Object.is(edited.value, candidate.value) ||
            edited.unit !== candidate.unit ||
            edited.referenceLow !== candidate.referenceLow ||
            edited.referenceHigh !== candidate.referenceHigh
          return {
            ...candidate,
            ...edited,
            // A corrected result must be explicitly re-confirmed before it can
            // ground regenerated advice.
            confirmed: changed ? false : candidate.confirmed,
          }
        })()
      : candidate
  )
}

export function toggleMetricCandidate(
  candidates: ReportMetricCandidate[],
  localId: string
): ReportMetricCandidate[] {
  return candidates.map((candidate) =>
    candidate.localId === localId
      ? { ...candidate, confirmed: !candidate.confirmed }
      : candidate
  )
}

export function removeMetricCandidate(
  candidates: ReportMetricCandidate[],
  localId: string
): ReportMetricCandidate[] {
  return candidates.filter((candidate) => candidate.localId !== localId)
}

export function addManualMetricCandidate(
  candidates: ReportMetricCandidate[],
  input: ReportMetricEdit
): ReportMetricCandidate[] {
  const name = cleanName(input.name)
  if (!name || !Number.isFinite(input.value)) return candidates
  return [
    ...candidates,
    {
      localId: nextAvailableLocalId(candidates, 'manual'),
      persistedId: null,
      name,
      value: input.value,
      unit: input.unit.trim(),
      referenceLow: input.referenceLow,
      referenceHigh: input.referenceHigh,
      confidence: null,
      uncertaintyReason: null,
      confirmed: false,
    },
  ]
}

/** Add an intentionally incomplete draft. It cannot be saved until the user
 * supplies a name and numeric result, avoiding a fabricated zero-value row. */
export function addBlankManualMetricCandidate(
  candidates: ReportMetricCandidate[]
): ReportMetricCandidate[] {
  return [
    ...candidates,
    {
      localId: nextAvailableLocalId(candidates, 'manual'),
      persistedId: null,
      name: '',
      value: Number.NaN,
      unit: '',
      referenceLow: null,
      referenceHigh: null,
      confidence: null,
      uncertaintyReason: null,
      confirmed: false,
    },
  ]
}

const metricId = (name: string) => {
  const slug = normalizedName(name)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  if (slug) return slug
  return `metric-${Array.from(name)
    .map((character) => character.codePointAt(0)?.toString(16))
    .join('-')}`
}

const uniqueMetricId = (base: string, used: Set<string>) => {
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

/**
 * Convert all valid reviewed fields for persistence. Unconfirmed and
 * low-confidence rows are intentionally retained so the report detail page
 * can show and correct them later; only `confirmed: true` rows may ground
 * recommendations on the server.
 */
export function toReviewedReportMetrics(
  candidates: ReportMetricCandidate[]
): ReportMetric[] {
  const seenNames = new Set<string>()
  const usedIds = new Set<string>()
  const metrics: ReportMetric[] = []
  for (const candidate of candidates) {
    const name = cleanName(candidate.name)
    const key = normalizedName(name)
    if (!name || !Number.isFinite(candidate.value) || seenNames.has(key)) {
      continue
    }
    seenNames.add(key)
    const id = uniqueMetricId(candidate.persistedId ?? metricId(name), usedIds)
    usedIds.add(id)
    metrics.push({
      id,
      name,
      value: candidate.value,
      unit: candidate.unit.trim(),
      referenceLow: candidate.referenceLow,
      referenceHigh: candidate.referenceHigh,
      status: computeMetricStatus(
        candidate.value,
        candidate.referenceLow,
        candidate.referenceHigh
      ),
      confidence: candidate.confidence,
      uncertaintyReason: candidate.uncertaintyReason,
      confirmed: candidate.confirmed,
    })
  }
  return metrics
}

/**
 * The confirmed, deduplicated metrics to persist. Only confirmed candidates
 * with a name and a finite value survive; duplicates (by normalized name) are
 * dropped; status is recomputed from the bounds (the server recomputes it
 * again on write, so a spoofed status can never reach storage).
 */
export function toConfirmedReportMetrics(
  candidates: ReportMetricCandidate[]
): ReportMetric[] {
  return toReviewedReportMetrics(candidates).filter(
    (metric) => metric.confirmed
  )
}
