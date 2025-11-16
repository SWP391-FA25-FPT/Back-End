import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const FriendRequestSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  }
}, { 
  timestamps: true 
});

// Thêm index để tối ưu tìm kiếm
FriendRequestSchema.index({ recipient: 1, status: 1 });
FriendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });

const FriendRequest = mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);

export default FriendRequest;