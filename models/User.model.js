import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, default: 'user', enum: ['user', 'admin', 'professional']},
  isFirstLogin: { type: Boolean, default: true },
  banned: { type: Boolean, default: false },
  bannedAt: Date,
  bannedReason: String,
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  profile: {
    weight: Number,
    height: Number,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    age: Number,
    workHabits: { type: String, enum: ['sedentary', 'light', 'moderate', 'active', 'very active'] },
    eatingHabits: { type: String, enum: ['light', 'moderate', 'heavy', 'snacker'] },
    diet: { type: String, enum: ['none', 'vegan', 'vegetarian', 'keto', 'paleo', 'gluten-free'] },
    allergies: [String],
    meals: [{ type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] }],
    profileImageUrl: String,
  },
  subscription: {
    status: { type: String, default: 'free' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
  },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash if password is modified or new
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to get user without password
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;