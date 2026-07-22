import { z } from 'zod'
import {
  DateStringSchema,
  FridgeCategorySchema,
} from '../../packages/contracts/src/schemas'

const urlWithHost = (host: string) =>
  z
    .string()
    .url()
    .startsWith('https://')
    .refine((value) => new URL(value).hostname === host, {
      message: `expected ${host} URL`,
    })

export const VisionScenarioSchema = z.enum([
  'full_fridge',
  'multi_ingredient_shelf',
  'occluded_or_blurry',
  'single_ingredient',
  'no_food',
])

export const GroundTruthIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    aliases: z.array(z.string().trim().min(1).max(100)).optional(),
    category: FridgeCategorySchema,
  })
  .strict()

export const VisionEvaluationImageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    scenario: VisionScenarioSchema,
    imageUrl: urlWithHost('upload.wikimedia.org'),
    sourcePageUrl: urlWithHost('commons.wikimedia.org'),
    author: z.string().trim().min(1),
    license: z.string().trim().min(1),
    groundTruth: z.array(GroundTruthIngredientSchema),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()

export const VisionEvaluationManifestSchema = z
  .object({
    version: z.literal(1),
    verifiedAt: DateStringSchema,
    sourcePolicy: z.string().trim().min(1),
    images: z.array(VisionEvaluationImageSchema).length(20),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>()
    for (const [index, image] of manifest.images.entries()) {
      if (ids.has(image.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate image id: ${image.id}`,
          path: ['images', index, 'id'],
        })
      }
      ids.add(image.id)
    }
  })

export type VisionEvaluationManifest = z.infer<
  typeof VisionEvaluationManifestSchema
>
export type VisionEvaluationImage = z.infer<
  typeof VisionEvaluationImageSchema
>
