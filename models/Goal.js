import mongoose from 'mongoose';

const WeightRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  weight: { type: Number, required: true },
  note: String
}, { _id: false });

const GoalSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  goalType: { 
    type: String, 
    enum: ['weight_loss', 'weight_gain', 'maintain'],
    required: true 
  },
  startWeight: { 
    type: Number, 
    required: true 
  },
  targetWeight: { 
    type: Number, 
    required: true 
  },
  currentWeight: { 
    type: Number, 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  duration: { 
    type: Number, 
    required: true, // in weeks
    min: 1
  },
  targetCaloriesPerDay: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'cancelled', 'paused'],
    default: 'active'
  },
  weeklyWeightChange: { 
    type: Number, 
    required: true // kg per week (negative for loss, positive for gain)
  },
  actualProgress: [WeightRecordSchema],
  description: String,
  warnings: [String] // Health warnings about the goal
}, {
  timestamps: true
});

// Index for finding active goals
GoalSchema.index({ userId: 1, status: 1 });
GoalSchema.index({ userId: 1, createdAt: -1 });

// Method to update current weight
GoalSchema.methods.updateWeight = function(weight, date = new Date(), note = '') {
  this.currentWeight = weight;
  this.actualProgress.push({ date, weight, note });
  
  // Check if goal is completed
  if (this.goalType === 'weight_loss' && weight <= this.targetWeight) {
    this.status = 'completed';
  } else if (this.goalType === 'weight_gain' && weight >= this.targetWeight) {
    this.status = 'completed';
  }
  
  return this.save();
};

// Method to calculate progress percentage
GoalSchema.methods.getProgressPercentage = function() {
  const totalChange = Math.abs(this.targetWeight - this.startWeight);
  const currentChange = Math.abs(this.currentWeight - this.startWeight);
  return totalChange === 0 ? 100 : Math.min(100, Math.round((currentChange / totalChange) * 100));
};

// Method to get days remaining
GoalSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

const Goal = mongoose.models.Goal || mongoose.model('Goal', GoalSchema);

export default Goal;





