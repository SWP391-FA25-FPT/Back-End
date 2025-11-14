import Notification from '../models/Notification.js';
import { sendBulkNotifications } from '../utils/notificationService.js';

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly } = req.query;

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);
    const skip = (pageNum - 1) * limitNum;

    const query = { user: req.user._id };
    if (unreadOnly === 'true') {
      query.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('actor', 'name username profile.profileImageUrl')
        .populate('recipe', 'name image status')
        .populate('blog', 'title imageUrl slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, readAt: null })
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      meta: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thông báo'
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy thông báo'
      });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo là đã đọc',
      data: notification
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật thông báo'
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật thông báo'
    });
  }
};

export const createAdminNotification = async (req, res) => {
  try {
    const { userIds, userId, title, message, type = 'admin', metadata } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập nội dung thông báo'
      });
    }

    const recipients = Array.isArray(userIds)
      ? userIds
      : userId
      ? [userId]
      : [];

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng chọn người nhận'
      });
    }

    const notifications = await sendBulkNotifications({
      userIds: recipients,
      type,
      title,
      message,
      actorId: req.user._id,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'Đã gửi thông báo',
      data: notifications
    });
  } catch (error) {
    console.error('Create admin notification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gửi thông báo'
    });
  }
};


