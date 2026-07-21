import type {
  DetectedIngredient,
  FridgeCategory,
} from '../../packages/contracts/src/schemas'

export interface GroundTruthIngredient {
  name: string
  category: FridgeCategory
  aliases?: string[]
}

export interface RecognitionScore {
  truePositives: number
  falsePositives: number
  falseNegatives: number
  categoryMatches: number
  matchedIngredients: number
  humanAdditions: number
  humanEdits: number
  humanDeletions: number
}

export interface EvaluatedImage {
  schemaValid: boolean
  latencyMs: number
  costUsd?: number
  score?: RecognitionScore
}

export interface VisionMetrics {
  schemaSuccessRate: number
  precision: number
  recall: number
  f1: number
  categoryAccuracy: number
  hallucinationRate: number
  humanAdditions: number
  humanEdits: number
  humanDeletions: number
  p50LatencyMs: number
  p95LatencyMs: number
  totalCostUsd: number
  costPerImageUsd: number
}

const normalizeName = (value: string): string =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const singularizeLastWord = (value: string): string => {
  const words = value.split(' ')
  const last = words.at(-1)
  if (!last || last.length <= 3 || last.endsWith('ss')) return value

  if (last.endsWith('ies')) words[words.length - 1] = `${last.slice(0, -3)}y`
  else if (last.endsWith('oes')) words[words.length - 1] = last.slice(0, -2)
  else if (last.endsWith('s')) words[words.length - 1] = last.slice(0, -1)
  return words.join(' ')
}

const nameVariants = (value: string): string[] => {
  const normalized = normalizeName(value)
  return [...new Set([normalized, singularizeLastWord(normalized)])]
}

export function scoreRecognition(
  expected: GroundTruthIngredient[],
  predicted: DetectedIngredient[]
): RecognitionScore {
  const remainingExpected = expected.map((ingredient) => ({
    ...ingredient,
    acceptedNames: new Set(
      [ingredient.name, ...(ingredient.aliases ?? [])].flatMap(nameVariants)
    ),
  }))

  let truePositives = 0
  let falsePositives = 0
  let categoryMatches = 0
  let humanEdits = 0

  for (const candidate of predicted) {
    const candidateNames = nameVariants(candidate.name)
    const expectedIndex = remainingExpected.findIndex((ingredient) =>
      candidateNames.some((name) => ingredient.acceptedNames.has(name))
    )

    if (expectedIndex < 0) {
      falsePositives += 1
      continue
    }

    const [matched] = remainingExpected.splice(expectedIndex, 1)
    truePositives += 1
    if (matched.category === candidate.category) {
      categoryMatches += 1
    } else {
      humanEdits += 1
    }
  }

  const falseNegatives = remainingExpected.length

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    categoryMatches,
    matchedIngredients: truePositives,
    humanAdditions: falseNegatives,
    humanEdits,
    humanDeletions: falsePositives,
  }
}

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 1 : numerator / denominator

const percentileNearestRank = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(percentile * sorted.length) - 1)
  return sorted[index]
}

export function aggregateVisionMetrics(
  evaluations: EvaluatedImage[]
): VisionMetrics {
  const scored = evaluations.flatMap((evaluation) =>
    evaluation.score ? [evaluation.score] : []
  )
  const sum = (field: keyof RecognitionScore): number =>
    scored.reduce((total, score) => total + score[field], 0)

  const truePositives = sum('truePositives')
  const falsePositives = sum('falsePositives')
  const falseNegatives = sum('falseNegatives')
  const matchedIngredients = sum('matchedIngredients')
  const hasScorableResponse = scored.length > 0
  const precision = hasScorableResponse
    ? ratio(truePositives, truePositives + falsePositives)
    : 0
  const recall = hasScorableResponse
    ? ratio(truePositives, truePositives + falseNegatives)
    : 0
  const f1 = hasScorableResponse
    ? ratio(2 * precision * recall, precision + recall)
    : 0
  const totalCostUsd = evaluations.reduce(
    (total, evaluation) => total + (evaluation.costUsd ?? 0),
    0
  )

  return {
    schemaSuccessRate: ratio(
      evaluations.filter((evaluation) => evaluation.schemaValid).length,
      evaluations.length
    ),
    precision,
    recall,
    f1,
    categoryAccuracy: hasScorableResponse
      ? ratio(sum('categoryMatches'), matchedIngredients)
      : 0,
    hallucinationRate:
      truePositives + falsePositives === 0
        ? 0
        : falsePositives / (truePositives + falsePositives),
    humanAdditions: sum('humanAdditions'),
    humanEdits: sum('humanEdits'),
    humanDeletions: sum('humanDeletions'),
    p50LatencyMs: percentileNearestRank(
      evaluations.map((evaluation) => evaluation.latencyMs),
      0.5
    ),
    p95LatencyMs: percentileNearestRank(
      evaluations.map((evaluation) => evaluation.latencyMs),
      0.95
    ),
    totalCostUsd,
    costPerImageUsd: ratio(totalCostUsd, evaluations.length),
  }
}
