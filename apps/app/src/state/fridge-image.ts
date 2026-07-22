import type {
  FridgeImageUpload,
  IngredientRecognitionResult,
} from '@akeso/domain'

const MAX_RECOGNITION_EDGE = 1024

export function resizeForRecognition(
  width: number,
  height: number
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_RECOGNITION_EDGE) return null
  return width >= height
    ? { width: MAX_RECOGNITION_EDGE }
    : { height: MAX_RECOGNITION_EDGE }
}

export async function runRecognitionAttempt(
  image: FridgeImageUpload,
  recognize: (
    image: FridgeImageUpload
  ) => Promise<IngredientRecognitionResult>
): Promise<
  | {
      ok: true
      image: FridgeImageUpload
      result: IngredientRecognitionResult
    }
  | { ok: false; image: FridgeImageUpload; error: string }
> {
  try {
    return { ok: true, image, result: await recognize(image) }
  } catch (error) {
    return {
      ok: false,
      image,
      error: error instanceof Error ? error.message : 'Recognition failed.',
    }
  }
}
