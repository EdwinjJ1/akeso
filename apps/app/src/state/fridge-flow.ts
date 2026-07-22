import type {
  FridgeCategory,
  FridgeItem,
  IngredientRecognitionResult,
} from '@akeso/domain'

export interface FridgeCandidate {
  localId: string
  name: string
  category: FridgeCategory
  confidence: number | null
  uncertaintyReason: string | null
  confirmed: boolean
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ')
const normalizedName = (name: string) => cleanName(name).toLocaleLowerCase()
const nextLocalId = (prefix: string, index: number) => `${prefix}-${index + 1}`

export function candidatesFromRecognition(
  result: IngredientRecognitionResult
): FridgeCandidate[] {
  if (result.status !== 'ok') return []
  return result.ingredients.map((ingredient, index) => ({
    localId: nextLocalId('recognized', index),
    ...ingredient,
    confirmed: false,
  }))
}

export function editCandidate(
  candidates: FridgeCandidate[],
  localId: string,
  patch: Pick<FridgeCandidate, 'name' | 'category'>
): FridgeCandidate[] {
  return candidates.map((candidate) =>
    candidate.localId === localId
      ? { ...candidate, name: cleanName(patch.name), category: patch.category }
      : candidate
  )
}

export function toggleCandidate(
  candidates: FridgeCandidate[],
  localId: string
): FridgeCandidate[] {
  return candidates.map((candidate) =>
    candidate.localId === localId
      ? { ...candidate, confirmed: !candidate.confirmed }
      : candidate
  )
}

export function removeCandidate(
  candidates: FridgeCandidate[],
  localId: string
): FridgeCandidate[] {
  return candidates.filter((candidate) => candidate.localId !== localId)
}

export function addManualCandidate(
  candidates: FridgeCandidate[],
  input: { name: string; category: FridgeCategory }
): FridgeCandidate[] {
  const name = cleanName(input.name)
  if (!name) return candidates
  return [
    ...candidates,
    {
      localId: nextLocalId('manual', candidates.length),
      name,
      category: input.category,
      confidence: null,
      uncertaintyReason: null,
      confirmed: true,
    },
  ]
}

const itemId = (name: string) => {
  const slug = normalizedName(name)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  if (slug) return slug
  return `ingredient-${Array.from(name)
    .map((character) => character.codePointAt(0)?.toString(16))
    .join('-')}`
}

export function toConfirmedFridgeItems(
  candidates: FridgeCandidate[]
): FridgeItem[] {
  const seen = new Set<string>()
  const items: FridgeItem[] = []
  for (const candidate of candidates) {
    const name = cleanName(candidate.name)
    const key = normalizedName(name)
    if (!candidate.confirmed || !name || seen.has(key)) continue
    seen.add(key)
    items.push({
      id: itemId(name),
      name,
      category: candidate.category,
      allergenTags: [],
    })
  }
  return items
}
