import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import serviceRoutes from './modules/services/services.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', serviceRoutes);

export default router;
