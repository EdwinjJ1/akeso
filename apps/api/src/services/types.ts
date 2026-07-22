import type {
  EnergyResult,
  FridgeItem,
  IngredientRecognitionResult,
  NutritionPlan,
  UserProfile,
} from '@akeso/domain'

export interface UploadedImage {
  bytes: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface NutritionGenerationInput {
  date: string
  fridge: FridgeItem[]
  energy: EnergyResult | null
  profile: UserProfile | null
}

export interface AiServices {
  recognizeIngredients(image: UploadedImage): Promise<IngredientRecognitionResult>
  generateNutrition(input: NutritionGenerationInput): Promise<NutritionPlan>
}

export interface VisionConfig {
  enabled: boolean
  provider: string
  mimoApiKey?: string
  mimoModel: string
  geminiApiKey?: string
  geminiModel: string
}
