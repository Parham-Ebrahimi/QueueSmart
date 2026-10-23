import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { createService, deleteService, getWaitTime, listServices, updateService } from './services.controller.js';

const router = Router();
const administrator = [authenticate, requireRole('admin')];

router.get('/services', authenticate, listServices);
router.post('/services', ...administrator, createService);
router.put('/services/:id', ...administrator, updateService);
router.delete('/services/:id', ...administrator, deleteService);
router.get('/queues/:id/wait-time', authenticate, getWaitTime);

export default router;
