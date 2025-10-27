import mongoose from 'mongoose';

const RatingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
}, {
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để query nhanh và đảm bảo mỗi user chỉ rate 1 lần cho 1 recipe
RatingSchema.index({ recipeId: 1, userId: 1 }, { unique: true });

export default mongoose.model('Rating', RatingSchema);