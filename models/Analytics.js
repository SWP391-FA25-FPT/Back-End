import mongoose from 'mongoose';

// Schema cho Recipe Analytics
const RecipeAnalyticsSchema = new mongoose.Schema({
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
  views: { type: Number, default: 0 },
  ratings: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

// Schema cho Search Analytics (tracking keywords/tags)
const SearchAnalyticsSchema = new mongoose.Schema({
  keyword: { type: String, required: true, unique: true, trim: true },
  searchCount: { type: Number, default: 1 },
  lastSearched: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Index để sort theo searchCount
SearchAnalyticsSchema.index({ searchCount: -1 });
SearchAnalyticsSchema.index({ lastSearched: -1 });

export const RecipeAnalytics = mongoose.models.RecipeAnalytics || mongoose.model('RecipeAnalytics', RecipeAnalyticsSchema);
export const SearchAnalytics = mongoose.models.SearchAnalytics || mongoose.model('SearchAnalytics', SearchAnalyticsSchema);

export default RecipeAnalytics;