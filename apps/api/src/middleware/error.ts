import { ZodError } from '@akeso/domain'
import type { NextFunction, Request, Response } from 'express'

import { HttpError } from '../http-error'
import { fail } from '../http'

/** Mounted after all routes — catches unmatched paths. */
export function notFoundHandler(req: Request, res: Response): void {
  fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`)
}

const describeZodError = (err: ZodError) =>
  err.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ')

/** Mounted last. Never forwards stack traces or error internals to the client. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof HttpError) {
    fail(res, err.status, err.code, err.message)
    return
  }

  if (err instanceof ZodError) {
    fail(res, 400, 'VALIDATION_ERROR', describeZodError(err))
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    fail(res, 400, 'VALIDATION_ERROR', 'Malformed request body')
    return
  }

  // body-parser/raw-body tag this error with `type` rather than a class we
  // can import — see https://github.com/expressjs/body-parser#errors.
  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    fail(res, 413, 'VALIDATION_ERROR', 'Request body too large')
    return
  }

  console.error(err)
  fail(res, 500, 'INTERNAL', 'Internal error')
}
