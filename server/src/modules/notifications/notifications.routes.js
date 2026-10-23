import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { listNotifications, readAllNotifications, readNotification } from './notifications.controller.js';

const router = Router();

router.get('/users/:userId/notifications', authenticate, listNotifications);
router.post('/users/:userId/notifications/read-all', authenticate, readAllNotifications);
router.post('/users/:userId/notifications/:notificationId/read', authenticate, readNotification);

export default router;
