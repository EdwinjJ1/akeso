import type { ReportMetricStatus } from '@akeso/domain'
import { useEffect, useRef } from 'react'

import { colors } from '@/theme/tokens'

/**
 * Guard for setState after an await: every async handler in the report flow
 * checks this before touching state, so navigating away mid-upload/mid-parse
 * never updates an unmounted component.
 */
export function useMountedRef() {
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  return mounted
}

export type ReportSource = 'camera' | 'photo' | 'pdf'

export interface SelectedFile {
  name: string
  source: ReportSource
  sizeLabel: string
  detail: string
}

export const statusColors: Record<ReportMetricStatus, string> = {
  low: colors.warning,
  high: colors.danger,
  normal: colors.primaryDark,
  unknown: colors.textMuted,
}

export const statusLabel: Record<ReportMetricStatus, string> = {
  low: 'Below report range',
  high: 'Above report range',
  normal: 'Within report range',
  unknown: 'No range on report',
}

export const statusIcon: Record<
  ReportMetricStatus,
  'arrow-down-circle' | 'arrow-up-circle' | 'checkmark-circle' | 'help-circle'
> = {
  low: 'arrow-down-circle',
  high: 'arrow-up-circle',
  normal: 'checkmark-circle',
  unknown: 'help-circle',
}

export const sourceIcon: Record<ReportSource, 'camera' | 'images' | 'document-text'> = {
  camera: 'camera',
  photo: 'images',
  pdf: 'document-text',
}

export const toNullableNumber = (text: string): number | null => {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return 'Size unavailable'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
