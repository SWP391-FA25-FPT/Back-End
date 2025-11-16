// src/utils/notificationService.js

import Notification from '../models/Notification.js';

const defaultTitles = {
  recipe_publish: 'Công thức đã lên sóng',
  comment: 'Bình luận mới',
  rating: 'Đánh giá mới',
  reaction: 'Phản hồi mới',
  admin: 'Thông báo từ quản trị viên',
  system: 'Thông báo',
  blog_approved: 'Blog đã được duyệt',
  blog_rejected: 'Blog bị từ chối',
  // THÊM TIÊU ĐỀ MẶC ĐỊNH CHO BẠN BÈ
  friend_request: 'Lời mời kết bạn mới',
  friend_accept: 'Chấp nhận kết bạn',
  friend_decline: 'Lời mời bị từ chối'
};

export const sendNotification = async ({
  userId,
  type = 'system',
  title,
  message,
  actorId,
  recipeId,
  blogId,
  metadata = {}
}) => {
  if (!userId || !message) {
    return null;
  }

  try {
    const notification = await Notification.create({
      user: userId,
      actor: actorId ?? undefined,
      recipe: recipeId ?? undefined,
      blog: blogId ?? undefined,
      type,
      // Sử dụng tiêu đề truyền vào, nếu không có thì lấy từ defaultTitles
      title: title || defaultTitles[type] || defaultTitles.system,
      message,
      metadata
    });

    return notification;
  } catch (error) {
    console.error('Send notification error:', error);
    return null;
  }
};

export const sendBulkNotifications = async ({
  userIds = [],
  type = 'system',
  title,
  message,
  actorId,
  recipeId,
  blogId,
  metadata = {}
}) => {
  if (!Array.isArray(userIds) || userIds.length === 0 || !message) {
    return [];
  }

  try {
    const bulkNotifications = userIds.map((user) => ({
      user,
      actor: actorId ?? undefined,
      recipe: recipeId ?? undefined,
      blog: blogId ?? undefined,
      type,
      title: title || defaultTitles[type] || defaultTitles.system,
      message,
      metadata
    }));
    
    const notifications = await Notification.insertMany(bulkNotifications);

    return notifications;
  } catch (error) {
    console.error('Send bulk notifications error:', error);
    return [];
  }
};