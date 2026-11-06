import { Router } from 'express';
import { getMyProfile, login, register, updateMyPassword, updateMyProfile } from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getMyProfile);
router.patch('/profile', authenticate, updateMyProfile);
router.post('/change-password', authenticate, updateMyPassword);

export default router;
