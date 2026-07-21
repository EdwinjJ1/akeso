import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IngredientRecognitionResultSchema } from '../../packages/contracts/src/schemas'
import { hasValidImageSignature } from './image'
import { VisionEvaluationManifestSchema } from './manifest'
import { aggregateVisionMetrics, scoreRecognition } from './metrics'
import {
  callVisionProvider,
  getVisionProviderCapability,
  UnsupportedVisionProviderError,
  type EncodedImage,
  type VisionProviderName,
} from './providers'

const FIVE_MIB = 5 * 1024 * 1024
const DEFAULT_MANIFEST = fileURLToPath(new URL('./manifest.json', import.meta.url))
const PROVIDERS = new Set<VisionProviderName>([
  'mimo',
  'openai',
  'gemini',
  'minimax',
])

interface CliOptions {
  dryRun: boolean
  manifestPath: string
  providers: VisionProviderName[]
  limit?: number
  outputPath?: string
  envFile?: string
}

const nextValue = (args: string[], index: number, name: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function parseCli(args: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    manifestPath: DEFAULT_MANIFEST,
    providers: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--manifest') {
      options.manifestPath = resolve(nextValue(args, index, arg))
      index += 1
    } else if (arg === '--providers') {
      const requested = nextValue(args, index, arg).split(',')
      for (const provider of requested) {
        if (!PROVIDERS.has(provider as VisionProviderName)) {
          throw new Error(`unknown provider: ${provider}`)
        }
      }
      options.providers = requested as VisionProviderName[]
      index += 1
    } else if (arg === '--limit') {
      options.limit = Number(nextValue(args, index, arg))
      if (!Number.isInteger(options.limit) || options.limit <= 0) {
        throw new Error('--limit must be a positive integer')
      }
      index += 1
    } else if (arg === '--output') {
      options.outputPath = resolve(nextValue(args, index, arg))
      index += 1
    } else if (arg === '--env-file') {
      options.envFile = resolve(nextValue(args, index, arg))
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.providers.length === 0) {
    if (options.dryRun) {
      options.providers = ['mimo', 'minimax', 'openai', 'gemini']
    }
    else throw new Error('--providers is required for a live evaluation')
  }

  return options
}

function loadEnvironment(envFile?: string): void {
  const candidate = envFile ?? resolve('apps/api/.env')
  if (existsSync(candidate)) process.loadEnvFile(candidate)
}

async function downloadImage(imageUrl: string): Promise<EncodedImage> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(imageUrl, { signal: controller.signal })
    if (!response.ok) throw new Error(`image download failed with HTTP ${response.status}`)
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > FIVE_MIB) throw new Error('image exceeds 5 MiB evaluation limit')

    const mimeType = response.headers.get('content-type')?.split(';')[0]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType ?? '')) {
      throw new Error(`unsupported image content type: ${mimeType ?? 'unknown'}`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > FIVE_MIB) throw new Error('image exceeds 5 MiB evaluation limit')
    if (!hasValidImageSignature(mimeType as EncodedImage['mimeType'], bytes)) {
      throw new Error('image signature does not match its content type')
    }

    return {
      mimeType: mimeType as EncodedImage['mimeType'],
      base64: bytes.toString('base64'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown evaluation error'

const configuredModel = (
  provider: VisionProviderName,
  defaultModel: string
): string => {
  const environmentKey: Record<VisionProviderName, string> = {
    mimo: 'MIMO_VISION_MODEL',
    openai: 'OPENAI_VISION_MODEL',
    gemini: 'GEMINI_VISION_MODEL',
    minimax: 'MINIMAX_VISION_MODEL',
  }
  return process.env[environmentKey[provider]] ?? defaultModel
}

async function evaluateProvider(
  provider: VisionProviderName,
  images: ReturnType<typeof VisionEvaluationManifestSchema.parse>['images']
) {
  const capability = getVisionProviderCapability(provider)
  if (!capability.supportsImageInput) {
    return {
      provider,
      model: capability.model,
      status: 'unsupported' as const,
      capability,
      images: [],
      metrics: null,
      admission: null,
    }
  }

  const evaluations = []
  for (const imageCase of images) {
    const startedAt = performance.now()
    try {
      const image = await downloadImage(imageCase.imageUrl)
      const response = await callVisionProvider(provider, image, process.env)
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(response.rawOutput)
      } catch {
        throw new Error('provider returned malformed structured output')
      }
      const contractResult = IngredientRecognitionResultSchema.safeParse(parsedJson)
      if (!contractResult.success) {
        throw new Error('provider output failed the recognition contract')
      }
      const recognition = contractResult.data
      const ingredients = recognition.status === 'ok' ? recognition.ingredients : []
      evaluations.push({
        id: imageCase.id,
        scenario: imageCase.scenario,
        schemaValid: true,
        latencyMs: response.latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costUsd: response.costUsd,
        recognition,
        score: scoreRecognition(imageCase.groundTruth, ingredients),
      })
    } catch (error) {
      if (error instanceof UnsupportedVisionProviderError) throw error
      evaluations.push({
        id: imageCase.id,
        scenario: imageCase.scenario,
        schemaValid: false,
        latencyMs: performance.now() - startedAt,
        costUsd: 0,
        error: errorMessage(error),
      })
    }
  }

  const metrics = aggregateVisionMetrics(evaluations)
  const admission = {
    schemaSuccessRate: metrics.schemaSuccessRate === 1,
    precision: metrics.precision >= 0.85,
    recall: metrics.recall >= 0.75,
    hallucinationRate: metrics.hallucinationRate <= 0.1,
    p95Latency: metrics.p95LatencyMs <= 15_000,
  }

  return {
    provider,
    model: configuredModel(provider, capability.model),
    status: 'completed' as const,
    capability,
    images: evaluations,
    metrics,
    admission: {
      ...admission,
      passed: Object.values(admission).every(Boolean),
    },
  }
}

async function main(): Promise<void> {
  const options = parseCli(process.argv.slice(2))
  loadEnvironment(options.envFile)
  const manifest = VisionEvaluationManifestSchema.parse(
    JSON.parse(readFileSync(options.manifestPath, 'utf8'))
  )
  const images = manifest.images.slice(0, options.limit ?? manifest.images.length)

  const report = options.dryRun
    ? {
        mode: 'dry-run',
        manifestVersion: manifest.version,
        verifiedAt: manifest.verifiedAt,
        imageCount: images.length,
        scenarioCounts: Object.fromEntries(
          [...new Set(images.map((image) => image.scenario))].map((scenario) => [
            scenario,
            images.filter((image) => image.scenario === scenario).length,
          ])
        ),
        providers: options.providers.map(getVisionProviderCapability),
      }
    : {
        mode: 'live',
        evaluatedAt: new Date().toISOString(),
        manifestVersion: manifest.version,
        verifiedAt: manifest.verifiedAt,
        imageCount: images.length,
        providers: await Promise.all(
          options.providers.map((provider) => evaluateProvider(provider, images))
        ),
      }

  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.outputPath) {
    await mkdir(dirname(options.outputPath), { recursive: true })
    await writeFile(options.outputPath, serialized, 'utf8')
  }
  process.stdout.write(serialized)
}

main().catch((error: unknown) => {
  process.stderr.write(`vision evaluation failed: ${errorMessage(error)}\n`)
  process.exitCode = 1
})
