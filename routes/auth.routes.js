import express from 'express';
// THAY ĐỔI 1: Import 2 hàm login mới và bỏ hàm login cũ
import { register, userLogin, adminLogin, getMe } from '../controllers/auth.controller.js';
import { forgotPassword, resetPassword } from '../controllers/forgotPassword.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
// THAY ĐỔI 2: Xóa route /login cũ và thêm 2 route mới
// router.post('/login', login); // <-- Xóa dòng này
router.post('/login/user', userLogin);   // <-- Thêm dòng này
router.post('/login/admin', adminLogin); // <-- Thêm dòng này

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);

export default router;