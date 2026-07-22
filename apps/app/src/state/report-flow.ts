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

export function candidateStatus(
  candidate: ReportMetricCandidate
): ReportMetricStatus {
  if (!Number.isFinite(candidate.value)) return 'unknown'
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

export function candidatesFromExtraction(
  result: ReportExtractionResult
): ReportMetricCandidate[] {
  if (result.status !== 'ok') return []
  return result.metrics.map((metric, index) => ({
    localId: nextLocalId('extracted', index),
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

export function editMetricCandidate(
  candidates: ReportMetricCandidate[],
  localId: string,
  patch: ReportMetricEdit
): ReportMetricCandidate[] {
  return candidates.map((candidate) =>
    candidate.localId === localId
      ? {
          ...candidate,
          name: cleanName(patch.name),
          value: patch.value,
          unit: patch.unit.trim(),
          referenceLow: patch.referenceLow,
          referenceHigh: patch.referenceHigh,
        }
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
      localId: nextLocalId('manual', candidates.length),
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

/**
 * The confirmed, deduplicated metrics to persist. Only confirmed candidates
 * with a name and a finite value survive; duplicates (by normalized name) are
 * dropped; status is recomputed from the bounds (the server recomputes it
 * again on write, so a spoofed status can never reach storage).
 */
export function toConfirmedReportMetrics(
  candidates: ReportMetricCandidate[]
): ReportMetric[] {
  const seen = new Set<string>()
  const metrics: ReportMetric[] = []
  for (const candidate of candidates) {
    const name = cleanName(candidate.name)
    const key = normalizedName(name)
    if (!candidate.confirmed || !name || !Number.isFinite(candidate.value)) {
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    metrics.push({
      id: metricId(name),
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
    })
  }
  return metrics
}
