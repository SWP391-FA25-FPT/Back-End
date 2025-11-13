import express from 'express';
import {
  createAdminNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../controllers/notification.controller.js';
import { admin, protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:id/read', protect, markNotificationRead);
router.post('/admin', protect, admin, createAdminNotification);

export default router;


