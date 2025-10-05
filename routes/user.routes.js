import express from 'express';
import { getProfile, updateProfile, completeOnboarding } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/complete-onboarding', completeOnboarding);

export default router;

