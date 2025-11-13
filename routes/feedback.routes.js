import express from 'express';
import {
  createFeedback,
  getAllFeedbacksAdmin,
  replyToFeedback,
  updateFeedbackStatus,
  getFeedbackStats,
} from '../controllers/feedback.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public/Protected routes
router.post('/', protect, createFeedback);

// Admin routes
router.get('/admin/all', protect, admin, getAllFeedbacksAdmin);
router.get('/admin/stats', protect, admin, getFeedbackStats);
router.put('/admin/:id/reply', protect, admin, replyToFeedback);
router.put('/admin/:id/status', protect, admin, updateFeedbackStatus);

export default router;

