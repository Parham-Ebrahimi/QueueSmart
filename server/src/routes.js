import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
// Each feature lives in src/modules/<feature>/ and is mounted here, e.g.
// router.use('/services', serviceRoutes);

export default router;
