import type { Response } from 'express'
import type { ApiResponse } from '@akeso/domain'

/** Every route responds through these two helpers — never `res.json(...)` directly. */

export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiResponse<T> = { success: true, data }
  res.status(status).json(body)
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string
): void {
  const body: ApiResponse<never> = { success: false, error: { code, message } }
  res.status(status).json(body)
}
