// Every error the API returns uses one shape:
// { "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "email": "..." } } }
// `details` maps field names to messages so the frontend can show them inline.
export default class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static validation(details, message = 'Some fields need your attention.') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Sign in to continue.', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'You do not have permission to do that.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'The requested resource was not found.') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message, details, code = 'CONFLICT') {
    return new ApiError(409, code, message, details);
  }

  toJSON() {
    const error = { code: this.code, message: this.message };
    if (this.details && Object.keys(this.details).length) error.details = this.details;
    return { error };
  }
}
