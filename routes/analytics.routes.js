import express from 'express';
import {
  trackSearch,
  getTrendingTags,
  getSearchStats
} from '../controllers/analytics.controller.js';

const router = express.Router();

// Public routes
router.post('/search', trackSearch);
router.get('/trending-tags', getTrendingTags);
router.get('/search-stats', getSearchStats);

export default router;

