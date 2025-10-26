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
  name: { type: String, required: true, trim: true },
  author: { type: String, required: true, trim: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Image URL
  totalTime: { type: String },
  servings: { type: Number, required: true },
  tags: [{ type: String }],
  ingredients: [ingredientSchema],
  steps: [stepSchema],
  nutrition: nutritionSchema,
  tips: [{ type: String }],
  reactions: [reactionSchema],
  views: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  trustScore: { type: Number, default: 0 }
}, {
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để sort theo views, trustScore
recipeSchema.index({ views: -1 });
recipeSchema.index({ trustScore: -1 });
recipeSchema.index({ createdAt: -1 });

export default mongoose.model('Recipe', recipeSchema);

