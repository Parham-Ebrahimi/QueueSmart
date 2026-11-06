import ApiError from '../../utils/ApiError.js';
import { changePassword, loginUser, profileForUser, registerUser, saveProfile } from './auth.service.js';
import { validateLogin, validatePasswordChange, validateProfile, validateRegistration } from './auth.validation.js';

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

export function getMyProfile(req, res) {
  res.json({ profile: profileForUser(req.user.id) });
}

export function updateMyProfile(req, res) {
  res.json(saveProfile(req.user.id, assertValid(validateProfile(req.body))));
}

export async function updateMyPassword(req, res) {
  res.json(await changePassword(req.user.id, assertValid(validatePasswordChange(req.body))));
}
