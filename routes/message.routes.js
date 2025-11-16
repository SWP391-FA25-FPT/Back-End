// routes/message.routes.js
import express from 'express';
import { 
    createOrGetConversation, 
    getConversations, 
    getMessages, 
    sendMessage, 
    updateMessage, 
    deleteMessage,
    
    // --- THÊM MỚI: Import 3 hàm mới ---
    getMessageRequests,
    acceptMessageRequest,
    declineMessageRequest

} from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js'; 

const router = express.Router();

// --- 1. CONVERSATION ROUTES (Hộp thư chính) ---
router.post('/', protect, createOrGetConversation); // Tạo/lấy convo
router.get('/', protect, getConversations); // Lấy HỘP THƯ CHÍNH

// --- 2. API MỚI CHO HỘP THƯ CHỜ ---
router.get('/requests', protect, getMessageRequests); // Lấy HỘP THƯ CHỜ
router.post('/requests/:conversationId/accept', protect, acceptMessageRequest); // Chấp nhận
router.delete('/requests/:conversationId/decline', protect, declineMessageRequest); // Từ chối

// --- 3. MESSAGE ROUTES (trong 1 conversation) ---
router.get('/:conversationId/messages', protect, getMessages); // Lấy tin nhắn (đã có logic cảnh báo)
router.post('/:conversationId/messages', protect, sendMessage); // Gửi tin nhắn (đã có logic tự accept)

// --- 4. CÁC ROUTE CŨ (Giữ nguyên) ---
router.put('/:messageId', protect, updateMessage); // Sửa tin
router.delete('/:messageId', protect, deleteMessage); // Xóa tin

export default router;