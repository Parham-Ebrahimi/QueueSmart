import jwt from 'jsonwebtoken';
import config from '../config.js';

export function signToken(user) {
  return jwt.sign({ email: user.email, role: user.role }, config.jwtSecret, { subject: user.id, expiresIn: config.tokenTtl });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
}
