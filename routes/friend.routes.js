import express from 'express';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  unfriendUser,
  getMyFriends
} from '../controllers/friend.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Tất cả các route này đều cần đăng nhập
router.use(protect);

router.post('/request', sendFriendRequest);
router.post('/accept/:requestId', acceptFriendRequest);
router.post('/decline/:requestId', declineFriendRequest); // Dùng chung cho cả decline và cancel
router.post('/unfriend', unfriendUser);
router.get('/me', getMyFriends); // API cho trang Message

export default router;