import express from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { forgotPassword, resetPassword } from '../controllers/forgotPassword.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);

export default router;


