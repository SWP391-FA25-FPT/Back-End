import User from '../models/User.model.js';
import Recipe from '../models/Recipe.js';
import Blog from '../models/Blog.js';
import { SearchAnalytics } from '../models/Analytics.js';
import Subscription from '../models/Subscription.js';
import Transaction from '../models/Transaction.js';

// @desc    Get system statistics (Admin only)
// @route   GET /api/admin/stats
// @access  Private (Admin only)
export const getSystemStats = async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const activeUsers = await User.countDocuments({
      'subscription.status': { $ne: 'free' },
    });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
    
    // User knowledge source statistics
    const usersByKnowledgeSource = await User.aggregate([
      { $match: { 'profile.knowledgeSource': { $exists: true, $ne: null } } },
      { $group: { _id: '$profile.knowledgeSource', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    // Map knowledge source values to display names
    const knowledgeSourceMap = {
      'social-media': 'Mạng xã hội (TikTok, Facebook)',
      'google-search': 'Tìm kiếm Google',
      'referral': 'Link chia sẻ / Referral',
      'advertisement': 'Quảng cáo',
      'other': 'Khác',
    };
    
    const trafficSource = usersByKnowledgeSource.map(item => ({
      name: knowledgeSourceMap[item._id] || item._id,
      value: item.count,
    }));

    // Recipe statistics
    const totalRecipes = await Recipe.countDocuments();
    const publishedRecipes = await Recipe.countDocuments({ published: true });
    const privateRecipes = await Recipe.countDocuments({ published: false });
    const totalRecipeViews = await Recipe.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const recipeViews = totalRecipeViews.length > 0 ? totalRecipeViews[0].totalViews : 0;

    // Blog statistics
    const totalBlogs = await Blog.countDocuments();
    const publishedBlogs = await Blog.countDocuments({ published: true });
    const unpublishedBlogs = await Blog.countDocuments({ published: false });
    const totalBlogViews = await Blog.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const blogViews = totalBlogViews.length > 0 ? totalBlogViews[0].totalViews : 0;

    // Subscription statistics
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const totalTransactions = await Transaction.countDocuments();
    const totalRevenue = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Analytics statistics
    const totalSearches = await SearchAnalytics.countDocuments();
    const topSearches = await SearchAnalytics.find()
      .sort({ searchCount: -1 })
      .limit(10)
      .select('keyword searchCount');

    // Growth statistics (last 30 days)
    const recipesLast30Days = await Recipe.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
    const blogsLast30Days = await Blog.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          byRole: usersByRole,
          active: activeUsers,
          new: newUsers,
          byKnowledgeSource: trafficSource,
        },
        recipes: {
          total: totalRecipes,
          published: publishedRecipes,
          private: privateRecipes,
          totalViews: recipeViews,
          new: recipesLast30Days,
        },
        blogs: {
          total: totalBlogs,
          published: publishedBlogs,
          unpublished: unpublishedBlogs,
          totalViews: blogViews,
          new: blogsLast30Days,
        },
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          totalTransactions,
          revenue,
        },
        analytics: {
          totalSearches,
          topSearches,
        },
      },
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê hệ thống',
    });
  }
};

