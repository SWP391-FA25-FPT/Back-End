import express from 'express';
import {
  createReport,
  getAllReportsAdmin,
  updateReportStatus,
  getReportStats,
} from '../controllers/report.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public/Protected routes
router.post('/', protect, createReport);

// Admin routes
router.get('/admin/all', protect, admin, getAllReportsAdmin);
router.get('/admin/stats', protect, admin, getReportStats);
router.put('/admin/:id/status', protect, admin, updateReportStatus);

export default router;

