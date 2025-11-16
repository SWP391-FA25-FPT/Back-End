import express from 'express';
import { 
    createOrGetConversation, 
    getConversations, 
    getMessages, 
    sendMessage, // <--- 1. THÊM IMPORT HÀM MỚI
    updateMessage, 
    deleteMessage 
} from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js'; 

const router = express.Router();

// --- 1. CONVERSATION ROUTES ---
router.post('/', protect, createOrGetConversation); 
router.get('/', protect, getConversations); 
router.get('/:conversationId/messages', protect, getMessages); 

// --- 2. THÊM ROUTE MỚI ĐỂ GỬI TIN NHẮN (BẠN ĐANG THIẾU) ---
router.post('/:conversationId/messages', protect, sendMessage); // <--- 2. THÊM ROUTE NÀY

// --- 3. GIỮ NGUYÊN CÁC ROUTE CŨ CỦA BẠN ---
router.put('/:messageId', protect, updateMessage); 
router.delete('/:messageId', protect, deleteMessage);

export default router;