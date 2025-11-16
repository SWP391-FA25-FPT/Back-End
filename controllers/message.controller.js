// src/controllers/message.controller.js
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.model.js'; 
import mongoose from 'mongoose';

// Hàm broadcastToConversationMembers (giữ nguyên, không đổi)
const broadcastToConversationMembers = async (conversationId, eventName, data) => {
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

// --- 1. CONVERSATION CRUD (ĐÃ SỬA ĐỔI) ---

/**
 * @desc    Tạo hoặc lấy 1 cuộc hội thoại 1-1 (ĐÃ SỬA LOGIC TIN NHẮN CHỜ)
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
        
        // 1. Tìm conversation 1-1 đã tồn tại (bất kể status)
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
        
        // --- 2. Kiểm tra bạn bè nếu tạo mới ---
        const sender = await User.findById(senderId).select('friends');
        
        // BỔ SUNG: Kiểm tra nếu không tìm thấy người gửi (tăng tính ổn định)
        if (!sender) {
             return res.status(404).json({ message: "Không tìm thấy thông tin người dùng (Sender)." });
        }

        const isFriend = sender.friends.includes(recipientId);

        // 3. Tạo mới với status tương ứng
        const newConversation = new Conversation({
            members: [senderId, recipientId],
            isGroup: false,
            // Nếu là bạn, 'accepted'. Nếu không là bạn, 'pending'.
            status: isFriend ? 'accepted' : 'pending',
            // Nếu là 'pending', lưu lại người gửi request
            requestedBy: isFriend ? undefined : senderId
        });
        await newConversation.save();
        
        return res.status(201).json({ 
            message: "Tạo Conversation thành công.", 
            conversation: newConversation 
        });
    } catch (error) {
        console.error("Lỗi khi tạo/lấy conversation:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Lấy tất cả cuộc hội thoại (HỘP THƯ CHÍNH - ĐÃ SỬA)
 */
export const getConversations = async (req, res) => {
     try {
        const userId = req.user.id;
        const conversations = await Conversation.find({
            members: userId,
            status: 'accepted' // <-- SỬA ĐỔI: Chỉ lấy các convo đã chấp nhận
        })
        .populate('members', 'name username profile.profileImageUrl') // Sửa: Lấy 'name' và 'profile.profileImageUrl' từ User model
        .populate('lastMessage') 
        .sort({ updatedAt: -1 }); 
        
        return res.status(200).json({ conversations });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách conversation:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Gửi một tin nhắn mới (ĐÃ SỬA)
 */
export const sendMessage = async (req, res) => {
    const io = global.io;
    if (!io) {
        return res.status(500).json({ message: "WebSocket Server chưa được khởi tạo." });
    }

    try {
        const { content } = req.body;
        const { conversationId } = req.params;
        const senderId = req.user.id; // Lấy từ middleware 'protect'

        if (!content || !conversationId) {
            return res.status(400).json({ message: "Thiếu nội dung hoặc ID hội thoại." });
        }
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy hội thoại." });
        }
        if (!conversation.members.includes(senderId)) {
            return res.status(403).json({ message: "Bạn không có quyền gửi tin nhắn vào hội thoại này." });
        }

        // --- THÊM MỚI: Logic tự động chấp nhận tin nhắn chờ ---
        // Nếu convo đang 'pending' VÀ người gửi LÀ NGƯỜI NHẬN (không phải người requestedBy)
        if (conversation.status === 'pending' && conversation.requestedBy.toString() !== senderId) {
            conversation.status = 'accepted';
            conversation.requestedBy = undefined; // Xóa cờ request
            await conversation.save();
            
            // (Optional) Gửi socket cho người gửi kia biết là "đã chấp nhận"
            // Tạm thời bỏ qua để giữ logic đơn giản
        }
        // --- HẾT PHẦN THÊM MỚI ---

        // Tạo tin nhắn mới
        const newMessage = new Message({
            conversationId,
            senderId, 
            content
        });
        await newMessage.save();

        // Cập nhật tin nhắn cuối cùng
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        const populatedMessage = await newMessage.populate('senderId', 'name username profile.profileImageUrl');

        // PHÁT SÓNG REAL-TIME
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
 * @desc    Lấy lịch sử tin nhắn của 1 conversation (ĐÃ SỬA)
 */
export const getMessages = async (req, res) => {
     try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const { page = 1, limit = 50 } = req.query; 

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.members.includes(userId)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập đoạn hội thoại này." });
        }
        
        // --- THÊM MỚI: Kiểm tra đây có phải là "CẢNH BÁO" cho người nhận không ---
        const isPendingForRecipient = conversation.status === 'pending' && conversation.requestedBy.toString() !== userId;

        if (isPendingForRecipient) {
            // Frontend sẽ dùng cờ 'isPendingForRecipient' này để hiển thị "cảnh báo"
            // và các nút "Accept/Decline" thay vì khung chat.
            return res.status(200).json({ 
                messages: [], // Không trả về tin nhắn
                page: 1, 
                limit: parseInt(limit),
                totalPages: 0,
                meta: {
                    isPendingForRecipient: true, // Cờ hiệu cho frontend
                    senderInfo: await User.findById(conversation.requestedBy).select('name username profile.profileImageUrl')
                }
            });
        }
        // --- HẾT PHẦN THÊM MỚI ---
        
        // Nếu không phải "cảnh báo" (là chat bthg hoặc là người gửi tin nhắn chờ)
        const messages = await Message.find({ 
            conversationId: conversationId,
            isDeleted: false 
        })
        .sort({ createdAt: -1 }) // Sắp xếp từ mới -> cũ để phân trang
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .populate('senderId', 'name username profile.profileImageUrl'); 

        const totalMessages = await Message.countDocuments({ conversationId: conversationId, isDeleted: false });
        
        return res.status(200).json({ 
            messages: messages.reverse(), // Đảo ngược lại để hiển thị (cũ -> mới)
            page: parseInt(page), 
            limit: parseInt(limit),
            totalPages: Math.ceil(totalMessages / parseInt(limit)),
            meta: { isPendingForRecipient: false }
        });
    } catch (error) {
        console.error("Lỗi khi lấy tin nhắn:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};


// --- 2. MESSAGE CRUD (Giữ nguyên update/delete) ---
// ... (Hàm updateMessage và deleteMessage của anh giữ nguyên)
export const updateMessage = async (req, res) => { /* ... (code cũ của anh) ... */ };
export const deleteMessage = async (req, res) => { /* ... (code cũ của anh) ... */ };


// --- 3. API MỚI CHO TIN NHẮN CHỜ ---

/**
 * @desc    Lấy danh sách tin nhắn chờ (HỘP THƯ CHỜ)
 * @route   GET /api/messages/requests
 */
export const getMessageRequests = async (req, res) => {
     try {
        const userId = req.user.id;
        const conversations = await Conversation.find({
            members: userId,
            status: 'pending',
            requestedBy: { $ne: userId } // Chỉ lấy cái mình là người NHẬN
        })
        .populate('members', 'name username profile.profileImageUrl') 
        .populate('lastMessage') 
        .sort({ updatedAt: -1 }); 
        
        return res.status(200).json({ conversations });
    } catch (error) {
        console.error("Lỗi khi lấy tin nhắn chờ:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Chấp nhận một tin nhắn chờ
 * @route   POST /api/messages/requests/:conversationId/accept
 */
export const acceptMessageRequest = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await Conversation.findOneAndUpdate(
            { 
                _id: conversationId, 
                status: 'pending',
                members: userId, // Phải là thành viên
                requestedBy: { $ne: userId } // Phải là người nhận
            },
            { 
                $set: { status: 'accepted', requestedBy: undefined } 
            },
            { new: true } // Trả về document đã update
        );

        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn chờ hoặc bạn không có quyền." });
        }
        
        // (Optional) Gửi socket báo cho người gửi là đã chấp nhận
        
        res.status(200).json({ message: "Đã chấp nhận tin nhắn.", conversation });
    } catch (error) {
        console.error("Lỗi khi chấp nhận tin nhắn chờ:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};

/**
 * @desc    Từ chối (Xóa) một tin nhắn chờ
 * @route   DELETE /api/messages/requests/:conversationId/decline
 */
export const declineMessageRequest = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        // Người nhận có thể từ chối (xóa convo)
        const conversation = await Conversation.findOne({
            _id: conversationId,
            status: 'pending',
            members: userId,
            requestedBy: { $ne: userId }
        });

        if (!conversation) {
            return res.status(404).json({ message: "Không tìm thấy tin nhắn chờ." });
        }

        // Xóa tất cả tin nhắn thuộc convo này
        await Message.deleteMany({ conversationId: conversation._id });
        // Xóa conversation
        await Conversation.findByIdAndDelete(conversation._id);
        
        res.status(200).json({ message: "Đã từ chối và xóa tin nhắn chờ." });
    } catch (error) {
        console.error("Lỗi khi từ chối tin nhắn chờ:", error);
        return res.status(500).json({ message: "Lỗi Server nội bộ." });
    }
};