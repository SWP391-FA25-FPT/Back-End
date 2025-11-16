// friend.controller.js

import User from '../models/User.model.js';
import FriendRequest from '../models/FriendRequest.model.js';
// BỔ SUNG: Import Conversation model để tự động tạo cuộc hội thoại
import Conversation from '../models/Conversation.js'; 
// QUAN TRỌNG: Import notification service
import { sendNotification } from '../utils/notificationService.js'; 

// @desc    Gửi lời mời kết bạn
// @route   POST /api/v1/friends/request
// @access  Private
export const sendFriendRequest = async (req, res) => {
  const { recipientId } = req.body;
  const senderId = req.user._id;

  try {
    if (senderId.toString() === recipientId) {
      return res.status(400).json({ success: false, error: 'Bạn không thể kết bạn với chính mình' });
    }

    // 1. Check xem đã là bạn bè chưa
    const sender = await User.findById(senderId);
    if (sender.friends.includes(recipientId)) {
      return res.status(400).json({ success: false, error: 'Đã là bạn bè' });
    }

    // 2. Check xem có request nào đang chờ giữa 2 người không
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId }
      ],
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, error: 'Đã gửi lời mời, vui lòng chờ' });
    }

    // 3. Tạo request mới
    const newRequest = await FriendRequest.create({
      sender: senderId,
      recipient: recipientId
    });
    
    // ✅ GỬI THÔNG BÁO CHO NGƯỜI NHẬN
    sendNotification({
        userId: recipientId,
        actorId: senderId,
        type: 'friend_request', 
        message: `${req.user.name || req.user.username} đã gửi lời mời kết bạn.`,
        metadata: {
            requestId: newRequest._id,
            senderId: senderId
        }
    });

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Chấp nhận lời mời
// @route   POST /api/v1/friends/accept/:requestId
// @access  Private
export const acceptFriendRequest = async (req, res) => {
  const { requestId } = req.params;
  const recipientId = req.user._id; // Người đang đăng nhập

  try {
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lời mời' });
    }

    // Chỉ người nhận mới được accept
    if (request.recipient.toString() !== recipientId.toString()) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền này' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Lời mời đã được xử lý' });
    }

    // Cập nhật status request
    request.status = 'accepted';
    await request.save();

    const senderId = request.sender;

    // Thêm bạn bè (2 chiều)
    await User.findByIdAndUpdate(recipientId, { $addToSet: { friends: senderId } });
    await User.findByIdAndUpdate(senderId, { $addToSet: { friends: recipientId } });
    
    // ==========================================================
    // --- LOGIC TỰ ĐỘNG TẠO CONVERSATION (BỔ SUNG) ---
    
    // 1. Kiểm tra Conversation 1-1 đã tồn tại chưa (bất kể status)
    const existingConversation = await Conversation.findOne({
        isGroup: false,
        members: { $all: [senderId, recipientId], $size: 2 }
    });
    
    // 2. Nếu chưa tồn tại, tạo mới với status 'accepted'
    if (!existingConversation) {
        await Conversation.create({
            members: [senderId, recipientId],
            isGroup: false,
            status: 'accepted', // Luôn là accepted vì họ đã là bạn bè
            requestedBy: undefined
        });
    }
    
    // --- HẾT PHẦN BỔ SUNG ---
    // ==========================================================
    
    // ✅ GỬI THÔNG BÁO CHO NGƯỜI GỬI (SENDER)
    sendNotification({
        userId: senderId,
        actorId: recipientId,
        type: 'friend_accept', 
        message: `${req.user.name || req.user.username} đã chấp nhận lời mời kết bạn của bạn.`,
        metadata: {
            recipientId: recipientId
        }
    });

    res.status(200).json({ success: true, message: 'Đã chấp nhận kết bạn' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Từ chối / Hủy lời mời
// @route   POST /api/v1/friends/decline/:requestId
// @access  Private
export const declineFriendRequest = async (req, res) => {
  const { requestId } = req.params;
  const userId = req.user._id; // Người đang đăng nhập

  try {
    const request = await FriendRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy lời mời' });
    }

    // Cả sender (hủy) và recipient (từ chối) đều có quyền này
    if (request.sender.toString() !== userId.toString() && request.recipient.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền này' });
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Lời mời đã được xử lý' });
    }

    // Cập nhật status (hoặc xóa)
    request.status = 'declined';
    await request.save();

    // ✅ GỬI THÔNG BÁO CHO BÊN CÒN LẠI KHI CÓ HÀNH ĐỘNG TỪ CHỐI
    const targetUserId = request.sender.toString() === userId.toString() ? request.recipient : request.sender;
    
    if (targetUserId) {
        sendNotification({
            userId: targetUserId,
            actorId: userId,
            type: 'friend_decline', 
            message: `${req.user.name || req.user.username} đã từ chối/hủy lời mời kết bạn.`,
            metadata: {
                initiatorId: userId
            }
        });
    }

    res.status(200).json({ success: true, message: 'Đã từ chối/hủy lời mời' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Hủy kết bạn (Unfriend)
// @route   POST /api/v1/friends/unfriend
// @access  Private
export const unfriendUser = async (req, res) => {
  const { friendId } = req.body;
  const userId = req.user._id;

  try {
    // Xóa bạn (2 chiều)
    await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });
    
    // Xóa/Cập nhật FriendRequest (nếu có)
    await FriendRequest.deleteMany({
      $or: [
        { sender: userId, recipient: friendId },
        { sender: friendId, recipient: userId }
      ]
    });

    res.status(200).json({ success: true, message: 'Đã hủy kết bạn' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Lấy danh sách bạn bè (Cho trang Message)
// @route   GET /api/v1/friends/me
// @access  Private
export const getMyFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'name username email profile.profileImageUrl')
      .select('friends');

    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy user' });
    }

    res.status(200).json({ success: true, data: user.friends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};