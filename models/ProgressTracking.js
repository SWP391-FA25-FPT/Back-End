import mongoose from 'mongoose';

const MacrosSchema = new mongoose.Schema({
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 }
}, { _id: false });

const ProgressTrackingSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  goalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Goal',
    default: null
  },
  mealPlanId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MealPlan',
    default: null
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  actualWeight: { 
    type: Number,
    default: null
  },
  actualCalories: { 
    type: Number, 
    default: 0 
  },
  actualMacros: {
    type: MacrosSchema,
    default: () => ({})
  },
  waterIntake: { 
    type: Number, 
    default: 0 // number of glasses
  },
  exercised: { 
    type: Boolean, 
    default: false 
  },
  exerciseDuration: {
    type: Number, // in minutes
    default: 0
  },
  exerciseType: {
    type: String,
    default: ''
  },
  notes: { 
    type: String,
    default: ''
  },
  mood: {
    type: String,
    enum: ['great', 'good', 'okay', 'bad', 'terrible', ''],
    default: ''
  }
}, {
  timestamps: true
});

// Compound index for finding user's progress by date
ProgressTrackingSchema.index({ userId: 1, date: -1 });
ProgressTrackingSchema.index({ userId: 1, goalId: 1, date: -1 });
ProgressTrackingSchema.index({ goalId: 1, date: -1 });

// Ensure only one record per user per day
ProgressTrackingSchema.index({ userId: 1, date: 1 }, { unique: true });

const ProgressTracking = mongoose.models.ProgressTracking || mongoose.model('ProgressTracking', ProgressTrackingSchema);

export default ProgressTracking;



