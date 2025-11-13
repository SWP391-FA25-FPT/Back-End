import express from 'express';
import {
  getProfile,
  updateProfile,
  completeOnboarding,
  getAllUsersAdmin,
  getUserByIdAdmin,
  updateUserAdmin,
  banUserAdmin,
  unbanUserAdmin,
  getUserStatsAdmin,
} from '../controllers/user.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';
import { uploadUser } from '../config/cloudinary.js';

const router = express.Router();

// Admin routes (must come before profile routes to avoid conflicts)
router.get('/admin/all', protect, admin, getAllUsersAdmin);
router.get('/admin/stats', protect, admin, getUserStatsAdmin);
router.get('/admin/:id', protect, admin, getUserByIdAdmin);
router.put('/admin/:id', protect, admin, updateUserAdmin);
router.put('/admin/:id/ban', protect, admin, banUserAdmin);
router.put('/admin/:id/unban', protect, admin, unbanUserAdmin);

// All other routes are protected (require authentication)
router.use(protect);

// Profile routes
router
  .route('/profile/:id?')
  .get(getProfile)
  .put(uploadUser.single('avatar'), updateProfile);
router.post('/complete-onboarding', completeOnboarding);

export default router;

