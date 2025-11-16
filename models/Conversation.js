// models/Conversation.js
import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', 
        required: true
    }],
    
    isGroup: {
        type: Boolean,
        default: false
    },
    
    groupName: {
        type: String,
        trim: true,
        sparse: true, 
    },
    
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message' 
    },

    // --- THÊM MỚI: Logic Tin nhắn chờ ---
    status: {
        type: String,
        enum: ['pending', 'accepted'], // pending: Đang chờ, accepted: Đã chấp nhận
        default: 'accepted'
    },

    // --- THÊM MỚI: Lưu ai là người gửi request (khi status là 'pending') ---
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        sparse: true // Chỉ tồn tại khi 'pending'
    }
    // --- HẾT PHẦN THÊM MỚI ---

}, { 
    timestamps: true 
});

// --- THÊM MỚI: Index để tối ưu query cho Hộp thư chính và Hộp thư chờ ---
conversationSchema.index({ members: 1, status: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;