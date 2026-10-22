const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production.');
}

const config = {
  env,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || 'queuesmart-dev-secret-change-me',
  tokenTtl: process.env.TOKEN_TTL || '8h',
  // Fewer bcrypt rounds keep the test suite fast; real logins use the default cost.
  bcryptRounds: env === 'test' ? 4 : 10,
  jsonBodyLimit: '10kb',
};

export default config;
