/**
 * errors.js
 * Central error types and helpers so every failure returns the SAME JSON envelope:
 *   { "error": { "code": "...", "message": "...", "details": [...] } }
 */

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details = []) => new ApiError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required.') => new ApiError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You do not have permission to perform this action.') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found.') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message, details = []) => new ApiError(409, 'CONFLICT', message, details);
export const lastAdmin = () => new ApiError(409, 'CONFLICT', 'Cannot remove the last administrator account. Operation refused.', [{ field: 'role', rule: 'last-admin' }]);
export const selfDemotion = () => new ApiError(409, 'CONFLICT', 'You cannot deactivate your own account.', [{ field: 'active', rule: 'self' }]);

/** Wraps an async Express handler so thrown errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
