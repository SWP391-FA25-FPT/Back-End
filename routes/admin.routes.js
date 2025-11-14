import express from 'express';
import { getSystemStats } from '../controllers/systemStats.controller.js';
import { getSystemSettings, updateSystemSettings } from '../controllers/systemSettings.controller.js';
import { protect, admin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(admin);

// System Statistics
router.get('/stats', getSystemStats);

// System Settings
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

export default router;

