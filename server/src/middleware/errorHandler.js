import ApiError from '../utils/ApiError.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}.`));
}

// Converts anything thrown in a route into the shared error-response format.
// Must keep all four parameters so Express treats it as an error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let apiError = err;

  if (!(err instanceof ApiError)) {
    if (err.type === 'entity.parse.failed') {
      apiError = new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
    } else if (err.type === 'entity.too.large') {
      apiError = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    } else {
      if (process.env.NODE_ENV !== 'test') console.error(err);
      apiError = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our end. Please try again.');
    }
  }

  res.status(apiError.status).json(apiError.toJSON());
}
