import Comment from '../models/Comment.js';
import Recipe from '../models/Recipe.js';
import { sendNotification } from '../utils/notificationService.js';

// @desc    Get comments by recipe ID
// @route   GET /api/recipes/:recipeId/comments
// @access  Public
export const getCommentsByRecipeId = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get comments with user info
    const comments = await Comment.find({ recipeId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Comment.countDocuments({ recipeId });

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy bình luận'
    });
  }
};

// @desc    Create new comment
// @route   POST /api/recipes/:recipeId/comments
// @access  Private
export const createComment = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { text } = req.body;

    // Validate input
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập nội dung bình luận'
      });
    }

    // Validate recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Create comment
    const comment = await Comment.create({
      userId: req.user._id,
      recipeId,
      text: text.trim()
    });

    // Populate user info before returning
    await comment.populate('userId', 'name email');

    if (
      recipe.authorId &&
      recipe.authorId.toString() !== req.user._id.toString()
    ) {
      const actorName = req.user.name || req.user.username || req.user.email;
      const truncatedText = text.trim().length > 120
        ? `${text.trim().slice(0, 117)}...`
        : text.trim();

      await sendNotification({
        userId: recipe.authorId,
        type: 'comment',
        message: `${actorName} đã bình luận về "${recipe.name}": "${truncatedText}"`,
        actorId: req.user._id,
        recipeId: recipe._id,
        metadata: {
          commentId: comment._id
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo bình luận thành công',
      data: comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tạo bình luận'
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private (owner or admin)
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy bình luận'
      });
    }

    // Check if user is owner or admin
    if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa bình luận này'
      });
    }

    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa bình luận thành công',
      data: {}
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi xóa bình luận'
    });
  }
};

