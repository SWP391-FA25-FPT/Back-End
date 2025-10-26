import express from 'express';
import {
  addViewHistory,
  getRecentViewed,
  clearViewHistory,
  getHistoryStats
} from '../controllers/userHistory.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/view', addViewHistory);
router.get('/recent', getRecentViewed);
router.delete('/clear', clearViewHistory);
router.get('/stats', getHistoryStats);

export default router;

