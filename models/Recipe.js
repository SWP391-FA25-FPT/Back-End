import mongoose from "mongoose";

const IngredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: String, required: true },
  },
  { _id: false }
);

const StepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const NutritionSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    fiber: { type: Number, required: true },
    sugar: { type: Number, required: true },
  },
  { _id: false }
);

const RelatedRecipeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
  },
  { _id: false }
);

const RecipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    prepTime: { type: String },
    cookTime: { type: String },
    totalTime: { type: String },
    servings: { type: Number },
    calories: { type: Number },
    difficulty: { type: String, enum: ["Dễ", "Trung bình", "Khó"] },
    tags: [{ type: String }],
    ingredients: [IngredientSchema],
    steps: [StepSchema],
    nutrition: NutritionSchema,
    tips: [{ type: String }],
    relatedRecipes: [RelatedRecipeSchema],
    videoUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Recipe || mongoose.model("Recipe", RecipeSchema);
