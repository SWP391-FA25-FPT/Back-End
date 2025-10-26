import mongoose from 'mongoose';

// Schema cho lịch sử xem recipe của user
const UserHistorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  recipeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Recipe', 
    required: true 
  },
  viewedAt: { 
    type: Date, 
    default: Date.now 
  },
  device: { 
    type: String, 
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  }
}, {
  timestamps: true
});

// Compound index để tìm lịch sử của user, sort theo thời gian
UserHistorySchema.index({ userId: 1, viewedAt: -1 });
UserHistorySchema.index({ recipeId: 1 });

// Tự động xóa các record cũ hơn 90 ngày
UserHistorySchema.index({ viewedAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export default mongoose.models.UserHistory || mongoose.model('UserHistory', UserHistorySchema);

