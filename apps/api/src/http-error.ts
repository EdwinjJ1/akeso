/** Thrown by route handlers to produce a specific ApiError envelope. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound = (message: string) => new HttpError(404, 'NOT_FOUND', message)
export const unauthorized = (message: string) =>
  new HttpError(401, 'UNAUTHORIZED', message)
export const validationError = (message: string) =>
  new HttpError(400, 'VALIDATION_ERROR', message)
