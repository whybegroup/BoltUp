/**
 * HTTP errors for controllers. Thrown values carry `status` so `server.ts`
 * error middleware can respond with the right status code.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly body?: Record<string, unknown>;

  constructor(status: number, message: string, body?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function httpError(
  status: number,
  message: string,
  body?: Record<string, unknown>
): HttpError {
  return new HttpError(status, message, body);
}
