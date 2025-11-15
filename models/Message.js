import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    // Đoạn hội thoại mà tin nhắn này thuộc về
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },

    // Người gửi tin nhắn
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Nội dung tin nhắn
    content: {
        type: String,
        required: true
    },

    // Trạng thái xóa tin nhắn (Soft Delete)
    isDeleted: {
        type: Boolean,
        default: false
    },

    // Các trường khác (ví dụ: loại tin nhắn: text, image, file...) có thể thêm sau.
}, { timestamps: true }); // Mongoose tự động thêm createdAt và updatedAt (dùng cho chỉnh sửa tin nhắn)

const Message = mongoose.model('Message', messageSchema);

export default Message;