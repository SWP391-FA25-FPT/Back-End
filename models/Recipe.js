import mongoose from 'mongoose';

// Schema cho nguyên liệu
const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: String, required: true }
}, { _id: false });

// Schema cho các bước thực hiện
const stepSchema = new mongoose.Schema({
  description: { type: String, required: true },
  image: { type: String } // Optional Cloudinary URL
}, { _id: false });

// Schema cho thông tin dinh dưỡng
const nutritionSchema = new mongoose.Schema({
  calories: Number,
  protein: Number,
  carbs: Number,
  fat: Number,
  fiber: Number,
  sugar: Number
}, { _id: false });

// Schema cho phản ứng
const reactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['delicious', 'love', 'fire'] },
  count: { type: Number, default: 0 }
}, { _id: false });

// Schema chính cho công thức nấu ăn
const recipeSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  author: { type: String, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
  image: { type: String }, // Image URL
  totalTime: { type: String },
  servings: { type: Number },
  tags: [{ type: String }],
  ingredients: [ingredientSchema],
  steps: [stepSchema],
  nutrition: nutritionSchema,
  tips: [{ type: String }],
  reactions: [reactionSchema],
  views: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  trustScore: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['draft', 'private', 'published'], 
    default: 'draft' 
  },
  lastEditedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date }
}, {
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Custom validation và auto-update timestamps
recipeSchema.pre('save', function(next) {
  // Update lastEditedAt mỗi khi save (trừ khi chỉ update views/saves/reactions)
  if (this.isModified()) {
    this.lastEditedAt = new Date();
  }
  
  // Set publishedAt khi chuyển sang published lần đầu
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Validate required fields khi status là 'published' hoặc 'private'
  if (this.status === 'published' || this.status === 'private') {
    if (!this.name || this.name.trim() === '') {
      return next(new Error('Tên món ăn là bắt buộc'));
    }
    if (!this.author || this.author.trim() === '') {
      return next(new Error('Tác giả là bắt buộc'));
    }
    if (!this.description || this.description.trim() === '') {
      return next(new Error('Mô tả là bắt buộc'));
    }
    if (!this.image || this.image.trim() === '') {
      return next(new Error('Ảnh món ăn là bắt buộc'));
    }
    if (!this.servings || this.servings < 1) {
      return next(new Error('Số khẩu phần là bắt buộc'));
    }
    if (!this.ingredients || this.ingredients.length === 0) {
      return next(new Error('Nguyên liệu là bắt buộc'));
    }
    if (!this.steps || this.steps.length === 0) {
      return next(new Error('Các bước thực hiện là bắt buộc'));
    }
  }
  next();
});

// Index để sort theo views, trustScore
recipeSchema.index({ views: -1 });
recipeSchema.index({ trustScore: -1 });
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ status: 1, authorId: 1 }); // Index for filtering by status and author

export default mongoose.model('Recipe', recipeSchema);

