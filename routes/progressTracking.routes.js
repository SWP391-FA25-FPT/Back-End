import express from 'express';
import {
  addProgressRecord,
  getProgressHistory,
  getProgressStats,
  updateProgressRecord,
  deleteProgressRecord,
  getTodayProgress
} from '../controllers/progressTracking.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get statistics
router.get('/stats', getProgressStats);

// Get today's progress
router.get('/today', getTodayProgress);

// Create and get progress records
router.route('/')
  .post(addProgressRecord)
  .get(getProgressHistory);

// Update and delete specific record
router.route('/:id')
  .put(updateProgressRecord)
  .delete(deleteProgressRecord);

export default router;



