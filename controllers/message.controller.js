import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';

// Giả định đối tượng Socket.IO đã được gán vào global.io 
// và danh sách người dùng active vào global.activeUsers trong server.js
const io = global.io; 
const activeUsers = global.activeUsers; // Map: key=userId, value=socketId

// --- UTILITY FUNCTION ---
// Hàm này giúp phát sóng sự kiện tới tất cả thành viên của một Conversation
const broadcastToConversationMembers = async (conversationId, eventName, data) => {
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
 * @desc    Tạo Conversation 1-1 mới với Author Blog hoặc lấy Conversation cũ. (CREATE/READ)
 * @route   POST /api/conversations
 * @access  Private (Cần xác thực)
 */
export const createOrGetConversation = async (req, res) => {
    try {
        const { recipientId } = req.body; 
        const senderId = req.user.id; 

        if (!mongoose.Types.ObjectId.isValid(recipientId)) {
            return res.status(400).json({ message: "Recipient ID không hợp lệ." });
        }
        if (senderId.toString() === recipientId.toString()) {
             return res.status(400).json({ message: "Không thể tự tạo hội thoại với chính mình." });
        }

        // 1. Kiểm tra xem Conversation 1-1 đã tồn tại chưa
        const existingConversation = await Conversation.findOne({
            isGroup: false,
            members: { $all: [senderId, recipientId], $size: 2 } // Chỉ tìm Conversation có đúng 2 thành viên
        });

        if (existingConversation) {
            // Đã tồn tại, trả về đoạn hội thoại cũ
            return res.status(200).json({ 
                message: "Conversation đã tồn tại.", 
                conversation: existingConversation 
            });
        }

        // 2. Chưa tồn tại, tạo Conversation mới
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
 * @desc    Lấy danh sách tất cả Conversation của User hiện tại (READ)
 * @route   GET /api/conversations
 * @access  Private
 */
export const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Tìm tất cả Conversation mà người dùng là thành viên
        const conversations = await Conversation.find({
            members: userId
        })
        .populate('members', 'username profile') 
        .populate('lastMessage') 
        .sort({ updatedAt: -1 }); 

        return res.status(200).json({ conversations });

    } catch (error) {
        console.error("Lỗi khi lấy danh sách conversation:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

// --- 2. MESSAGE CRUD ---

/**
 * @desc    Lấy lịch sử tin nhắn của một Conversation (READ)
 * @route   GET /api/conversations/:conversationId/messages
 * @access  Private
 */
export const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query; 

        // 1. Kiểm tra quyền: Đảm bảo người dùng là thành viên của Conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.members.includes(userId)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập đoạn hội thoại này." });
        }

        // 2. Lấy tin nhắn có phân trang
        const messages = await Message.find({ 
            conversationId: conversationId,
            isDeleted: false 
        })
        .sort({ sentAt: 1 }) // Sắp xếp tin cũ trước
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('senderId', 'username profile'); 

        // Total count (cho Frontend biết tổng số trang)
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
 * @desc    Chỉnh sửa nội dung tin nhắn (UPDATE) - CÓ PHÁT SÓNG REAL-TIME
 * @route   PUT /api/messages/:messageId
 * @access  Private
 */
export const updateMessage = async (req, res) => {
    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }
    
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.id; 

        // 1. Tìm tin nhắn và kiểm tra quyền
        const message = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false });

        if (!message) {
            return res.status(404).json({ message: "Tin nhắn không tồn tại hoặc bạn không phải người gửi." });
        }
        
        // 2. Cập nhật nội dung và thời gian
        message.content = content;
        message.updatedAt = new Date(); 
        await message.save();

        // 3. PHÁT SÓNG REAL-TIME: Thông báo tin nhắn đã chỉnh sửa
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
 * @desc    Xóa tin nhắn (Soft Delete) (DELETE) - CÓ PHÁT SÓNG REAL-TIME
 * @route   DELETE /api/messages/:messageId
 * @access  Private
 */
export const deleteMessage = async (req, res) => {
    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }
    
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        // 1. Tìm tin nhắn để lấy conversationId trước khi xóa
        const messageToDelete = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false });

        if (!messageToDelete) {
             return res.status(404).json({ message: "Tin nhắn không tồn tại hoặc bạn không có quyền xóa." });
        }
        
        const conversationId = messageToDelete.conversationId;

        // 2. Thực hiện Soft Delete
        const result = await Message.updateOne(
            { _id: messageId },
            { $set: { isDeleted: true, updatedAt: new Date() } }
        );

        if (result.modifiedCount === 0) { // Dùng modifiedCount cho Mongoose 5+/6+
            return res.status(404).json({ message: "Không tìm thấy hoặc tin nhắn đã bị xóa." });
        }

        // 3. PHÁT SÓNG REAL-TIME: Thông báo tin nhắn đã xóa
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