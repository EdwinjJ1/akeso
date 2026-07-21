import { describe, expect, test } from 'vitest'

import {
  addManualCandidate,
  candidatesFromRecognition,
  editCandidate,
  removeCandidate,
  toConfirmedFridgeItems,
  toggleCandidate,
} from './fridge-flow'

describe('fridge recognition confirmation flow', () => {
  const result = {
    status: 'ok' as const,
    ingredients: [
      {
        name: 'Tomato',
        category: 'vegetable' as const,
        confidence: 0.92,
        uncertaintyReason: null,
      },
      {
        name: 'Tofu',
        category: 'protein' as const,
        confidence: 0.61,
        uncertaintyReason: 'Partly hidden',
      },
    ],
  }

  test('every AI candidate starts unconfirmed', () => {
    expect(candidatesFromRecognition(result).map((item) => item.confirmed)).toEqual([
      false,
      false,
    ])
  })

  test('supports edit, delete, manual add and partial confirmation', () => {
    let candidates = candidatesFromRecognition(result)
    candidates = editCandidate(candidates, candidates[0].localId, {
      name: 'Cherry tomato',
      category: 'fruit',
    })
    candidates = toggleCandidate(candidates, candidates[0].localId)
    candidates = removeCandidate(candidates, candidates[1].localId)
    candidates = addManualCandidate(candidates, {
      name: 'Rice',
      category: 'grain',
    })

    expect(toConfirmedFridgeItems(candidates)).toEqual([
      { id: 'cherry-tomato', name: 'Cherry tomato', category: 'fruit' },
      { id: 'rice', name: 'Rice', category: 'grain' },
    ])
  })

  test('normalizes and deduplicates confirmed names', () => {
    const candidates = [
      ...addManualCandidate([], { name: '  Oat   Milk ', category: 'dairy' }),
      ...addManualCandidate([], { name: 'oat milk', category: 'other' }),
    ]
    expect(toConfirmedFridgeItems(candidates)).toEqual([
      { id: 'oat-milk', name: 'Oat Milk', category: 'dairy' },
    ])
  })

  test('manual non-Latin ingredient names still receive a valid id', () => {
    const candidates = addManualCandidate([], {
      name: '🍎',
      category: 'fruit',
    })
    expect(toConfirmedFridgeItems(candidates)[0].id.length).toBeGreaterThan(0)
  })
})
