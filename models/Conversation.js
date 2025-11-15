import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    // Danh sách các thành viên trong đoạn hội thoại. 
    // Dùng kiểu mongoose.Schema.Types.ObjectId để tham chiếu đến User._id.
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Giả định tên Model User của bạn là 'User' (hoặc 'User.model')
        required: true
    }],
    
    // Kiểm tra xem đây là chat nhóm hay chat 1-1
    isGroup: {
        type: Boolean,
        default: false
    },
    
    // Tên nhóm (chỉ có nếu isGroup là true)
    groupName: {
        type: String,
        trim: true,
        sparse: true, // Cho phép giá trị null/undefined, nhưng nếu có thì phải duy nhất (ít quan trọng trong trường hợp này)
    },
    
    // ID của tin nhắn cuối cùng (dùng để hiển thị xem trước)
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message' // Tham chiếu đến Message Model
    },

    // Các trường khác (ví dụ: avatar nhóm, admin nhóm nếu là group) có thể thêm sau.
}, { timestamps: true }); // Mongoose tự động thêm createdAt và updatedAt

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;