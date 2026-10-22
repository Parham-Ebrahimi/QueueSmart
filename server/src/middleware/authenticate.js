import ApiError from '../utils/ApiError.js';
import { ROLE_LABELS, ROLES } from '../utils/roles.js';
import { verifyToken } from '../utils/tokens.js';

// Requires a valid "Authorization: Bearer <token>" header and sets req.user = { id, email, role }.
export function authenticate(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  try {
    const payload = verifyToken(token);
    if (!ROLES.includes(payload.role)) throw new Error('Unknown role in token.');
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return next(ApiError.unauthorized('Your session has expired. Sign in again.', 'TOKEN_EXPIRED'));
    return next(ApiError.unauthorized('Your session is not valid. Sign in again.', 'INVALID_TOKEN'));
  }
}

// Use after authenticate, e.g. router.post('/services', authenticate, requireRole('admin'), createService).
export function requireRole(...allowedRoles) {
  const labels = allowedRoles.map(role => ROLE_LABELS[role] || role).join(' or ');
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.includes(req.user.role)) return next(ApiError.forbidden(`This action requires the ${labels} role.`));
    return next();
  };
}
