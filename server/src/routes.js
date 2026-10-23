import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import queueRoutes from './modules/queues/queues.routes.js';
import serviceRoutes from './modules/services/services.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', serviceRoutes);
router.use('/', queueRoutes);

export default router;
