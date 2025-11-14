import mongoose from 'mongoose';

const IngredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: String, required: true },
}, { _id: false });

const MealPlanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null }, // NEW: null = health-based, has value = goal-based
  meals: [
    {
      type: { type: String, required: true },
      recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
      name: { type: String, required: true },
      calories: { type: Number, required: true },
      macros: {
        protein: { type: Number, required: true },
        carbs: { type: Number, required: true },
        fat: { type: Number, required: true },
        fiber: { type: Number, default: 0 },
        sugar: { type: Number, default: 0 }
      },
      imageUrl: { type: String },
      ingredients: [IngredientSchema],
    }
  ],
  totalCalories: { type: Number, required: true },
  totalMacros: {
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    fiber: { type: Number, default: 0 },
    sugar: { type: Number, default: 0 }
  },
  targetCalories: { type: Number, required: true },
});

const MealPlan = mongoose.models.MealPlan || mongoose.model('MealPlan', MealPlanSchema);

export default MealPlan;
