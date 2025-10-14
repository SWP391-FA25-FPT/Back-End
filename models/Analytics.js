const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
  views: { type: Number, default: 0 },
  ratings: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Analytics || mongoose.model('Analytics', AnalyticsSchema);