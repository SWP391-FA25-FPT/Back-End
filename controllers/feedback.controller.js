import Feedback from '../models/Feedback.js';

// @desc    Create feedback
// @route   POST /api/feedback
// @access  Private
export const createFeedback = async (req, res) => {
  try {
    const { type, subject, message, challengeId } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ thông tin: subject và message',
      });
    }

    const feedback = await Feedback.create({
      userId: req.user._id,
      userEmail: req.user.email,
      userName: req.user.name || req.user.email,
      type: type || 'other',
      subject,
      message,
      challengeId: challengeId || undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Gửi feedback thành công',
      data: feedback,
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi gửi feedback',
    });
  }
};

// @desc    Get all feedbacks (Admin only)
// @route   GET /api/feedback/admin/all
// @access  Private (Admin only)
export const getAllFeedbacksAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'name email')
      .populate('reply.repliedBy', 'name email');

    const total = await Feedback.countDocuments(query);

    res.status(200).json({
      success: true,
      data: feedbacks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all feedbacks admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách feedback',
    });
  }
};

// @desc    Reply to feedback (Admin only)
// @route   PUT /api/feedback/admin/:id/reply
// @access  Private (Admin only)
export const replyToFeedback = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập nội dung phản hồi',
      });
    }

    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy feedback',
      });
    }

    feedback.reply = {
      message,
      repliedBy: req.user._id,
      repliedAt: new Date(),
    };
    feedback.status = 'replied';
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Phản hồi feedback thành công',
      data: feedback,
    });
  } catch (error) {
    console.error('Reply to feedback error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy feedback',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi phản hồi feedback',
    });
  }
};

// @desc    Update feedback status (Admin only)
// @route   PUT /api/feedback/admin/:id/status
// @access  Private (Admin only)
export const updateFeedbackStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['pending', 'replied', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status không hợp lệ',
      });
    }

    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy feedback',
      });
    }

    feedback.status = status;
    await feedback.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật status feedback thành công',
      data: feedback,
    });
  } catch (error) {
    console.error('Update feedback status error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy feedback',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật status feedback',
    });
  }
};

// @desc    Get feedback statistics (Admin only)
// @route   GET /api/feedback/admin/stats
// @access  Private (Admin only)
export const getFeedbackStats = async (req, res) => {
  try {
    const totalFeedbacks = await Feedback.countDocuments();
    const feedbacksByStatus = await Feedback.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const feedbacksByType = await Feedback.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const pendingFeedbacks = await Feedback.countDocuments({ status: 'pending' });

    res.status(200).json({
      success: true,
      data: {
        totalFeedbacks,
        feedbacksByStatus,
        feedbacksByType,
        pendingFeedbacks,
      },
    });
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê feedback',
    });
  }
};

