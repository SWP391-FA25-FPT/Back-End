import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema(
  {
    // General settings
    systemName: {
      type: String,
      default: 'Meta Meal',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    timezone: {
      type: String,
      default: 'UTC+7',
    },
    language: {
      type: String,
      enum: ['vi', 'en'],
      default: 'vi',
    },

    // Security settings
    twoFactorAuth: {
      type: Boolean,
      default: false,
    },
    lockThreshold: {
      type: Number,
      default: 5,
      min: 1,
      max: 20,
    },
    sessionTimeout: {
      type: Number,
      default: 30,
      min: 5,
      max: 480,
    },

    // AI settings
    aiEnabled: {
      type: Boolean,
      default: true,
    },
    aiCreativity: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1,
    },
    aiDailyLimit: {
      type: Number,
      default: 15,
      min: 0,
      max: 1000,
    },

    // Notification settings
    notifyEmail: {
      type: Boolean,
      default: true,
    },
    notifyFeedback: {
      type: Boolean,
      default: true,
    },
    notifyPremium: {
      type: Boolean,
      default: true,
    },

    // Metadata
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

export default SystemSettings;

