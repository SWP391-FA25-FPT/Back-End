// src/models/Notification.js

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe'
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Blog'
    },
    // Trường type: Thêm các loại thông báo bạn bè vào enum
    type: {
      type: String,
      enum: [
        'recipe_publish',
        'comment', 
        'rating', 
        'reaction', 
        'admin', 
        'system', 
        'blog_approved', 
        'blog_rejected', 
        'challenge_winner',
        'friend_request',   // ⬅️ THÊM
        'friend_accept',    // ⬅️ THÊM
        'friend_decline'    // ⬅️ THÊM
      ],
      default: 'system'
    },
    title: {
      type: String,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.virtual('isRead').get(function () {
  return Boolean(this.readAt);
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;