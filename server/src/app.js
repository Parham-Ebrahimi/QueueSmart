import express from 'express';
import config from './config.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import apiRoutes from './routes.js';

// Builds the Express app without starting it, so tests can call it through supertest.
export function createApp() {
  const app = express();
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use('/api', apiRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
