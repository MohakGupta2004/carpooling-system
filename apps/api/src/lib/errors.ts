export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', msg, details);
export const Unauthorized = (msg = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', msg);
export const Forbidden = (msg = 'Insufficient permissions', details?: unknown) =>
  new AppError(403, 'FORBIDDEN', msg, details);
export const NotFound = (msg = 'Resource not found') => new AppError(404, 'NOT_FOUND', msg);
export const Conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);
export const UnprocessableEntity = (msg: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', msg, details);
