import mongoose from 'mongoose';
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

    // Tìm tất cả records cũ của recipe này (để tránh duplicate)
    // Chỉ giữ lại 1 record duy nhất cho mỗi recipe
    const existingViews = await UserHistory.find({
      userId,
      recipeId
    });

    if (existingViews.length > 0) {
      // Nếu đã có record, xóa tất cả và tạo mới (để đưa lên đầu với thời gian mới nhất)
      await UserHistory.deleteMany({
        userId,
        recipeId
      });
    }

    // Tạo record mới với thời gian hiện tại
    await UserHistory.create({
      userId,
      recipeId,
      device,
      viewedAt: Date.now()
    });

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

    // Lấy lịch sử xem của user, group by recipeId để tránh duplicate
    // Sử dụng aggregation để lấy mỗi recipe một lần với viewedAt mới nhất
    const historyAggregation = await UserHistory.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $sort: { viewedAt: -1 } },
      {
        $group: {
          _id: '$recipeId',
          viewedAt: { $first: '$viewedAt' },
          device: { $first: '$device' },
          historyId: { $first: '$_id' }
        }
      },
      { $sort: { viewedAt: -1 } },
      { $limit: limitNum }
    ]);

    // Populate recipe info
    const historyIds = historyAggregation.map(item => item.historyId);
    const history = await UserHistory.find({ _id: { $in: historyIds } })
      .populate({
        path: 'recipeId',
        select: 'name author image totalTime servings tags views'
      })
      .sort({ viewedAt: -1 });

    // Filter ra các recipe đã bị xóa và format response
    const validHistory = history.filter(item => item.recipeId !== null);

    // Format response - đảm bảo mỗi recipe chỉ xuất hiện 1 lần
    const recipeMap = new Map();
    validHistory.forEach(item => {
      const recipeId = item.recipeId._id.toString();
      if (!recipeMap.has(recipeId)) {
        recipeMap.set(recipeId, {
          _id: item.recipeId._id,
          name: item.recipeId.name,
          author: item.recipeId.author,
          image: item.recipeId.image,
          totalTime: item.recipeId.totalTime,
          servings: item.recipeId.servings,
          tags: item.recipeId.tags,
          views: item.recipeId.views,
          viewedAt: item.viewedAt
        });
      }
    });

    const recentRecipes = Array.from(recipeMap.values());

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

