import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate.js';
import { getEntry, getQueue, join, leave, listHistory, listQueues, moveEntry, removeEntry, serveNext } from './queues.controller.js';

const router = Router();
const administrator = [authenticate, requireRole('admin')];
const member = [authenticate, requireRole('user')];

router.get('/queues', authenticate, listQueues);
router.get('/queues/:serviceId', authenticate, getQueue);
router.post('/queues/:serviceId/join', ...member, join);
router.post('/queues/:serviceId/leave', ...member, leave);
router.post('/queues/:serviceId/serve-next', ...administrator, serveNext);
router.get('/queues/:serviceId/entries/:entryId', authenticate, getEntry);
router.delete('/queues/:serviceId/entries/:entryId', ...administrator, removeEntry);
router.post('/queues/:serviceId/entries/:entryId/move', ...administrator, moveEntry);
router.get('/users/:userId/history', authenticate, listHistory);

export default router;
