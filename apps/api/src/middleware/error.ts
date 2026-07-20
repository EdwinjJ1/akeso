import type { NextFunction, Request, Response } from 'express'

import { fail } from '../http'

/** Mounted after all routes — catches unmatched paths. */
export function notFoundHandler(req: Request, res: Response): void {
  fail(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`)
}

/** Mounted last. Never forwards stack traces or error internals to the client. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express only treats a 4-arg function as an error handler — `next` must
  // stay in the signature even though this handler always terminates.
  _next: NextFunction
): void {
  if (err instanceof SyntaxError && 'body' in err) {
    fail(res, 400, 'VALIDATION_ERROR', 'Malformed request body')
    return
  }

  console.error(err)
  fail(res, 500, 'INTERNAL', 'Internal error')
}
