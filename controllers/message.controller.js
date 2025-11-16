// src/controllers/message.controller.js
// --- PHIÊN BẢN HOÀN CHỈNH ---

import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';

/**
 * Hàm nội bộ để phát sự kiện socket tới các thành viên
 * SỬA LỖI: Lấy global.io bên trong hàm
 */
const broadcastToConversationMembers = async (conversationId, eventName, data) => {
    // ✅ LẤY BIẾN global BÊN TRONG HÀM
    const io = global.io;
    const activeUsers = global.activeUsers;

    try {
        const conversation = await Conversation.findById(conversationId);
        if (conversation && io && activeUsers) {
            conversation.members.forEach(memberId => {
                const memberSocketId = activeUsers.get(memberId.toString());
                if (memberSocketId) {
                    io.to(memberSocketId).emit(eventName, data);
                }
            });
        }
    } catch (error) {
        console.error(`Lỗi khi phát sóng sự kiện ${eventName}:`, error);
    }
};

// --- 1. CONVERSATION CRUD ---

/**
 * @desc    Tạo hoặc lấy 1 cuộc hội thoại 1-1
 */
export const createOrGetConversation = async (req, res) => {
    try {
        const { recipientId } = req.body; 
        const senderId = req.user.id; // ID người dùng hiện tại

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: "Recipient ID không hợp lệ." });
        }
        if (senderId.toString() === recipientId.toString()) {
             return res.status(400).json({ message: "Không thể tự tạo hội thoại với chính mình." });
        }
        
        // Tìm conversation 1-1 đã tồn tại
        const existingConversation = await Conversation.findOne({
            isGroup: false,
            members: { $all: [senderId, recipientId], $size: 2 }
        });
        
        if (existingConversation) {
            return res.status(200).json({ 
                message: "Conversation đã tồn tại.", 
                conversation: existingConversation 
            });
        }
        
        // Tạo mới nếu chưa có
        const newConversation = new Conversation({
            members: [senderId, recipientId],
            isGroup: false,
        });
        await newConversation.save();
        
        return res.status(201).json({ 
            message: "Tạo Conversation 1-1 thành công.", 
            conversation: newConversation 
        });
    } catch (error) {
        console.error("Lỗi khi tạo/lấy conversation:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Lấy tất cả cuộc hội thoại của user
 */
export const getConversations = async (req, res) => {
     try {
        const userId = req.user.id;
        const conversations = await Conversation.find({
            members: userId
        })
        .populate('members', 'username profile') 
        .populate('lastMessage') 
        .sort({ updatedAt: -1 }); // Sắp xếp theo tin nhắn mới nhất
        
        return res.status(200).json({ conversations });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách conversation:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

// --- 2. MESSAGE CRUD ---

/**
 * @desc    Lấy lịch sử tin nhắn của 1 conversation
 */
export const getMessages = async (req, res) => {
     try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query; // Phân trang

        const conversation = await Conversation.findById(conversationId);
        // Kiểm tra user có thuộc conversation không
        if (!conversation || !conversation.members.includes(userId)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập đoạn hội thoại này." });
        }
        
        const messages = await Message.find({ 
            conversationId: conversationId,
            isDeleted: false // Chỉ lấy tin chưa bị xóa
        })
        .sort({ createdAt: 1 }) // Sắp xếp từ cũ đến mới
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('senderId', 'username profile'); 

        const totalMessages = await Message.countDocuments({ conversationId: conversationId, isDeleted: false });
        
        return res.status(200).json({ 
            messages, 
            page: parseInt(page), 
            limit: parseInt(limit),
            totalPages: Math.ceil(totalMessages / parseInt(limit))
        });
    } catch (error) {
        console.error("Lỗi khi lấy tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Gửi một tin nhắn mới (ĐÃ SỬA)
 */
export const sendMessage = async (req, res) => {
    // ✅ LẤY BIẾN global BÊN TRONG HÀM
    const io = global.io;

    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }

    try {
        const { content } = req.body;
        const { conversationId } = req.params;
        
        // 🚨 SỬA LỖI LOGIC QUAN TRỌNG:
        // 'senderId' luôn là ID của người dùng đã đăng nhập (lấy từ middleware 'protect')
        const senderId = req.user.id;

        if (!content || !conversationId) {
            return res.status(400).json({ message: "Thiếu nội dung hoặc ID hội thoại." });
        }
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
             return res.status(400).json({ message: "Conversation ID không hợp lệ." });
        }
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy hội thoại." });
        }
        // Kiểm tra người gửi có trong hội thoại không
        if (!conversation.members.includes(senderId)) {
            return res.status(403).json({ message: "Bạn không có quyền gửi tin nhắn vào hội thoại này." });
        }

        // Tạo tin nhắn mới với senderId ĐÚNG
        const newMessage = new Message({
            conversationId,
            senderId, // <-- Gán senderId là người gửi
            content
        });
        await newMessage.save();

        // Cập nhật tin nhắn cuối cùng cho conversation
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: newMessage._id,
            updatedAt: new Date()
        });

        // Populate thông tin người gửi để gửi cho client
        const populatedMessage = await newMessage.populate('senderId', 'username profile');

        // PHÁT SÓNG REAL-TIME (Sự kiện tên 'newMessage')
        broadcastToConversationMembers(conversationId, 'newMessage', populatedMessage);

        return res.status(201).json({ 
            message: "Gửi tin nhắn thành công.", 
            newMessage: populatedMessage 
        });

    } catch (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Chỉnh sửa nội dung tin nhắn (ĐÃ SỬA)
 */
export const updateMessage = async (req, res) => {
    // ✅ LẤY BIẾN global BÊN TRONG HÀM
    const io = global.io;

    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }
    
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.id; 

        // Chỉ tìm tin nhắn mà user này là người gửi
        const message = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false });
        if (!message) {
            return res.status(404).json({ message: "Tin nhắn không tồn tại hoặc bạn không phải người gửi." });
        }
        
        message.content = content;
        message.updatedAt = new Date(); 
        await message.save();

        // Phát sóng sự kiện cập nhật
        broadcastToConversationMembers(message.conversationId, 'messageUpdated', {
            messageId: message._id,
            newContent: message.content,
            updatedAt: message.updatedAt
        });
        
        return res.status(200).json({ message: "Tin nhắn đã được chỉnh sửa thành công.", updatedMessage: message });

    } catch (error) {
        console.error("Lỗi khi cập nhật tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Xóa tin nhắn (Soft Delete) (ĐÃ SỬA)
 */
export const deleteMessage = async (req, res) => {
    // ✅ LẤY BIẾN global BÊN TRONG HÀM
    const io = global.io;
    
    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }
    
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        // Chỉ tìm tin nhắn mà user này là người gửi
        const messageToDelete = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false });
        if (!messageToDelete) {
             return res.status(404).json({ message: "Tin nhắn không tồn tại hoặc bạn không có quyền xóa." });
        }
        
        const conversationId = messageToDelete.conversationId;

        // Thực hiện Soft Delete
        const result = await Message.updateOne(
            { _id: messageId },
            { $set: { isDeleted: true, updatedAt: new Date() } }
        );

        if (result.modifiedCount === 0) { 
            return res.status(404).json({ message: "Không tìm thấy hoặc tin nhắn đã bị xóa." });
        }

        // Phát sóng sự kiện xóa
        broadcastToConversationMembers(conversationId, 'messageDeleted', {
            messageId: messageId,
            conversationId: conversationId
        });

        return res.status(200).json({ message: "Tin nhắn đã được xóa thành công." });

    } catch (error) {
        console.error("Lỗi khi xóa tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};