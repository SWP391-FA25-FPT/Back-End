import express from 'express';
import { 
    createOrGetConversation, 
    getConversations, 
    getMessages, 
    updateMessage, 
    deleteMessage 
} from '../controllers/message.controller.js';
// Giả định middleware xác thực của bạn nằm ở đây
// Vui lòng thay 'authMiddleware' bằng tên file hoặc hàm middleware thực tế của bạn
import { protect } from '../middleware/auth.middleware.js'; 

const router = express.Router();

// Tất cả các route này đều cần người dùng đã đăng nhập (bảo vệ bằng protect)

// --- 1. CONVERSATION ROUTES ---

// POST: Tạo Conversation 1-1 mới với Author Blog (hoặc lấy Conversation cũ nếu đã tồn tại)
// Body: { "recipientId": "..." }
router.post('/', protect, createOrGetConversation); 

// GET: Lấy danh sách tất cả Conversation của User hiện tại (READ)
router.get('/', protect, getConversations); 

// GET: Lấy lịch sử tin nhắn của một Conversation (READ)
// Query: ?page=1&limit=50 (dùng cho Pagination)
router.get('/:conversationId/messages', protect, getMessages); 

// --- 2. MESSAGE CRUD ROUTES ---

// PUT: Chỉnh sửa nội dung tin nhắn (UPDATE)
// Body: { "content": "Nội dung đã chỉnh sửa" }
router.put('/:messageId', protect, updateMessage); 

// DELETE: Xóa tin nhắn (Soft Delete) (DELETE)
router.delete('/:messageId', protect, deleteMessage);

export default router;