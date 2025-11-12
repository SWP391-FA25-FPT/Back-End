import express from 'express';
import { getSystemStats } from '../controllers/systemStats.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(admin);

// System Statistics
router.get('/stats', getSystemStats);

export default router;

