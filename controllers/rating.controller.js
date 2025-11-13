import Rating from '../models/Rating.js';
import Recipe from '../models/Recipe.js';
import { sendNotification } from '../utils/notificationService.js';

// @desc    Get ratings by recipe ID
// @route   GET /api/recipes/:recipeId/ratings
// @access  Public
export const getRatingsByRecipeId = async (req, res) => {
  try {
    const { recipeId } = req.params;

    // Validate recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Get all ratings for this recipe
    const ratings = await Rating.find({ recipeId });

    // Calculate statistics
    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;

    // Count by star
    const ratingDistribution = {
      1: ratings.filter(r => r.rating === 1).length,
      2: ratings.filter(r => r.rating === 2).length,
      3: ratings.filter(r => r.rating === 3).length,
      4: ratings.filter(r => r.rating === 4).length,
      5: ratings.filter(r => r.rating === 5).length,
    };

    // Get user's rating if authenticated
    let userRating = null;
    if (req.user) {
      const userRatingDoc = await Rating.findOne({
        recipeId,
        userId: req.user._id
      });
      userRating = userRatingDoc ? userRatingDoc.rating : null;
    }

    res.status(200).json({
      success: true,
      data: {
        totalRatings,
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        ratingDistribution,
        userRating
      }
    });
  } catch (error) {
    console.error('Get ratings error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy đánh giá'
    });
  }
};

// @desc    Create or update rating
// @route   POST /api/recipes/:recipeId/ratings
// @access  Private
export const createOrUpdateRating = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { rating } = req.body;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Đánh giá phải từ 1 đến 5 sao'
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

    // Check if user already rated this recipe
    let ratingDoc = await Rating.findOne({
      recipeId,
      userId: req.user._id
    });

    const actorName = req.user.name || req.user.username || req.user.email;
    const isUpdate = Boolean(ratingDoc);

    if (ratingDoc) {
      // Update existing rating
      ratingDoc.rating = rating;
      await ratingDoc.save();
    } else {
      // Create new rating
      ratingDoc = await Rating.create({
        userId: req.user._id,
        recipeId,
        rating
      });
    }

    if (
      recipe.authorId &&
      recipe.authorId.toString() !== req.user._id.toString()
    ) {
      await sendNotification({
        userId: recipe.authorId,
        type: 'rating',
        message: `${actorName} đã ${isUpdate ? 'cập nhật đánh giá' : 'đánh giá'} ${rating} sao cho "${recipe.name}".`,
        actorId: req.user._id,
        recipeId: recipe._id,
        metadata: {
          ratingId: ratingDoc._id,
          rating
        }
      });
    }

    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate ? 'Cập nhật đánh giá thành công' : 'Tạo đánh giá thành công',
      data: ratingDoc
    });
  } catch (error) {
    console.error('Create/Update rating error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tạo/cập nhật đánh giá'
    });
  }
};

// @desc    Delete rating
// @route   DELETE /api/ratings/:id
// @access  Private (owner only)
export const deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findById(req.params.id);

    if (!rating) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy đánh giá'
      });
    }

    // Check if user is owner
    if (rating.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xóa đánh giá này'
      });
    }

    await rating.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa đánh giá thành công',
      data: {}
    });
  } catch (error) {
    console.error('Delete rating error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi xóa đánh giá'
    });
  }
};

// @desc    Delete user's rating for a recipe
// @route   DELETE /api/recipes/:recipeId/ratings
// @access  Private
export const deleteUserRating = async (req, res) => {
  try {
    const { recipeId } = req.params;

    const rating = await Rating.findOne({
      recipeId,
      userId: req.user._id
    });

    if (!rating) {
      return res.status(404).json({
        success: false,
        error: 'Bạn chưa đánh giá công thức này'
      });
    }

    await rating.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa đánh giá thành công',
      data: {}
    });
  } catch (error) {
    console.error('Delete user rating error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi xóa đánh giá'
    });
  }
};

