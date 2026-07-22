import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { VisionEvaluationManifestSchema } from './manifest'

const manifestPath = fileURLToPath(new URL('./manifest.json', import.meta.url))
const manifest = VisionEvaluationManifestSchema.parse(
  JSON.parse(readFileSync(manifestPath, 'utf8'))
)

describe('vision evaluation manifest', () => {
  it('contains 20 uniquely identified, URL-only licensed images', () => {
    expect(manifest.images).toHaveLength(20)
    expect(new Set(manifest.images.map((image) => image.id)).size).toBe(20)

    for (const image of manifest.images) {
      expect(image.imageUrl).toMatch(/^https:\/\//)
      expect(image.sourcePageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
      expect(image.author.length).toBeGreaterThan(0)
      expect(image.license.length).toBeGreaterThan(0)
    }
  })

  it('covers full, shelf, occluded, single, and empty/unrecognizable scenes', () => {
    expect(new Set(manifest.images.map((image) => image.scenario))).toEqual(
      new Set([
        'full_fridge',
        'multi_ingredient_shelf',
        'occluded_or_blurry',
        'single_ingredient',
        'no_food',
      ])
    )
    expect(
      manifest.images.filter((image) => image.groundTruth.length === 0).length
    ).toBeGreaterThanOrEqual(4)
  })
})
