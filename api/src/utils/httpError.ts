/**
 * HTTP errors for controllers. Thrown values carry `status` so `server.ts`
 * error middleware can respond with the right status code.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function httpError(status: number, message: string): HttpError {
  return new HttpError(status, message);
}
