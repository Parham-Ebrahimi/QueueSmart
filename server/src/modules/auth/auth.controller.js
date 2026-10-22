import ApiError from '../../utils/ApiError.js';
import { loginUser, registerUser } from './auth.service.js';
import { validateLogin, validateRegistration } from './auth.validation.js';

function assertValid({ errors, value }) {
  if (Object.keys(errors).length) throw ApiError.validation(errors);
  return value;
}

// POST /api/auth/register  { email, password, confirmPassword?, role? } -> 201 { token, user }
export async function register(req, res) {
  const input = assertValid(validateRegistration(req.body));
  res.status(201).json(await registerUser(input));
}

// POST /api/auth/login  { email, password, role? } -> 200 { token, user }
export async function login(req, res) {
  const input = assertValid(validateLogin(req.body));
  res.json(await loginUser(input));
}
