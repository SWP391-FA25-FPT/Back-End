import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
  text: { type: String, required: true },
}, {
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để query nhanh theo recipeId
CommentSchema.index({ recipeId: 1, createdAt: -1 });

export default mongoose.model('Comment', CommentSchema);