import UserHistory from '../models/UserHistory.js';
import Recipe from '../models/Recipe.js';

// @desc    Add recipe to user's view history
// @route   POST /api/user/history/view
// @access  Private (authenticated users)
export const addViewHistory = async (req, res) => {
  try {
    const { recipeId, device = 'unknown' } = req.body;
    const userId = req.user._id;

    if (!recipeId) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp recipeId'
      });
    }

    // Kiểm tra recipe có tồn tại không
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy recipe'
      });
    }

    // Kiểm tra xem user đã xem recipe này trong vòng 1 giờ chưa (tránh duplicate)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existingView = await UserHistory.findOne({
      userId,
      recipeId,
      viewedAt: { $gte: oneHourAgo }
    });

    if (existingView) {
      // Cập nhật thời gian xem
      existingView.viewedAt = Date.now();
      existingView.device = device;
      await existingView.save();
    } else {
      // Tạo record mới
      await UserHistory.create({
        userId,
        recipeId,
        device,
        viewedAt: Date.now()
      });
    }

    // Giới hạn lịch sử của user ở 50 items gần nhất
    const historyCount = await UserHistory.countDocuments({ userId });
    if (historyCount > 50) {
      const oldestRecords = await UserHistory.find({ userId })
        .sort({ viewedAt: 1 })
        .limit(historyCount - 50)
        .select('_id');
      
      const idsToDelete = oldestRecords.map(record => record._id);
      await UserHistory.deleteMany({ _id: { $in: idsToDelete } });
    }

    res.status(200).json({
      success: true,
      message: 'Đã lưu lịch sử xem'
    });
  } catch (error) {
    console.error('Add view history error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        success: false,
        error: 'ID không hợp lệ'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lưu lịch sử xem'
    });
  }
};

// @desc    Get user's recently viewed recipes
// @route   GET /api/user/history/recent
// @access  Private (authenticated users)
export const getRecentViewed = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20 } = req.query;
    const limitNum = parseInt(limit);

    // Lấy lịch sử xem của user
    const history = await UserHistory.find({ userId })
      .sort({ viewedAt: -1 })
      .limit(limitNum)
      .populate({
        path: 'recipeId',
        select: 'name author image totalTime servings tags views'
      });

    // Filter ra các recipe đã bị xóa
    const validHistory = history.filter(item => item.recipeId !== null);

    // Format response
    const recentRecipes = validHistory.map(item => ({
      _id: item.recipeId._id,
      name: item.recipeId.name,
      author: item.recipeId.author,
      image: item.recipeId.image,
      totalTime: item.recipeId.totalTime,
      servings: item.recipeId.servings,
      tags: item.recipeId.tags,
      views: item.recipeId.views,
      viewedAt: item.viewedAt
    }));

    res.status(200).json({
      success: true,
      data: recentRecipes
    });
  } catch (error) {
    console.error('Get recent viewed error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy lịch sử xem'
    });
  }
};

// @desc    Clear user's view history
// @route   DELETE /api/user/history/clear
// @access  Private (authenticated users)
export const clearViewHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    await UserHistory.deleteMany({ userId });

    res.status(200).json({
      success: true,
      message: 'Đã xóa lịch sử xem'
    });
  } catch (error) {
    console.error('Clear view history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi xóa lịch sử xem'
    });
  }
};

// @desc    Get user's history statistics
// @route   GET /api/user/history/stats
// @access  Private (authenticated users)
export const getHistoryStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const totalViewed = await UserHistory.countDocuments({ userId });
    
    // Lấy các tag được xem nhiều nhất
    const history = await UserHistory.find({ userId })
      .populate('recipeId', 'tags');

    const tagCounts = {};
    history.forEach(item => {
      if (item.recipeId && item.recipeId.tags) {
        item.recipeId.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.status(200).json({
      success: true,
      data: {
        totalViewed,
        topTags
      }
    });
  } catch (error) {
    console.error('Get history stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê lịch sử'
    });
  }
};

