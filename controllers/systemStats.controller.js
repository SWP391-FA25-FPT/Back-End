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
    
    // Calculate previous month stats for comparison
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const previousMonthNewUsers = await User.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
    });
    
    // Calculate percentage change for new users
    const newUsersChange = previousMonthNewUsers > 0
      ? ((newUsers - previousMonthNewUsers) / previousMonthNewUsers * 100).toFixed(0)
      : newUsers > 0 ? 100 : 0;
    
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
    
    // Calculate previous month active subscriptions
    const previousMonthStart = new Date();
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    previousMonthStart.setDate(1);
    previousMonthStart.setHours(0, 0, 0, 0);
    const previousMonthEnd = new Date();
    previousMonthEnd.setDate(0);
    previousMonthEnd.setHours(23, 59, 59, 999);
    
    const previousMonthActiveSubscriptions = await Subscription.countDocuments({
      status: 'active',
      startDate: { $lte: previousMonthEnd },
      $or: [
        { endDate: { $gte: previousMonthStart } },
        { endDate: null }
      ]
    });
    
    const activeSubscriptionsChange = previousMonthActiveSubscriptions > 0
      ? ((activeSubscriptions - previousMonthActiveSubscriptions) / previousMonthActiveSubscriptions * 100).toFixed(0)
      : activeSubscriptions > 0 ? 100 : 0;
    
    const totalTransactions = await Transaction.countDocuments();
    const totalRevenue = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    
    // Calculate previous month revenue
    const previousMonthRevenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const prevRevenue = previousMonthRevenue.length > 0 ? previousMonthRevenue[0].total : 0;
    
    const revenueChange = prevRevenue > 0
      ? ((revenue - prevRevenue) / prevRevenue * 100).toFixed(0)
      : revenue > 0 ? 100 : 0;
    
    // Premium users growth by month (12 months of selected year)
    // Get year from query parameter, default to current year
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
    
    // Get all active subscriptions
    const allActiveSubscriptions = await Subscription.find({ status: 'active' }).select('startDate endDate');
    
    // Generate data for 12 months of the selected year (Th01 to Th12)
    const monthlyGrowth = [];
    for (let month = 1; month <= 12; month++) {
      const date = new Date(selectedYear, month - 1, 1); // month is 0-indexed
      const endOfMonth = new Date(selectedYear, month, 0, 23, 59, 59); // Last day of month
      
      // Count subscriptions that were active at the end of this month
      // (startDate <= endOfMonth AND endDate >= date)
      const count = allActiveSubscriptions.filter(sub => {
        return sub.startDate <= endOfMonth && sub.endDate >= date;
      }).length;
      
      // Format month label: "ThMM" (e.g., "Th01", "Th02")
      const monthLabel = `Th${String(month).padStart(2, '0')}`;
      
      monthlyGrowth.push({
        month: monthLabel,
        value: count,
      });
    }

    // Analytics statistics
    const totalSearches = await SearchAnalytics.countDocuments();
    
    // Calculate previous month searches
    const previousMonthSearches = await SearchAnalytics.countDocuments({
      createdAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
    });
    
    const searchesChange = previousMonthSearches > 0
      ? ((totalSearches - previousMonthSearches) / previousMonthSearches * 100).toFixed(0)
      : totalSearches > 0 ? 100 : 0;
    
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
          activeChange: parseFloat(activeSubscriptionsChange),
          totalTransactions,
          revenue,
          revenueChange: parseFloat(revenueChange),
          monthlyGrowth: monthlyGrowth,
        },
        analytics: {
          totalSearches,
          searchesChange: parseFloat(searchesChange),
          topSearches,
        },
        users: {
          total: totalUsers,
          byRole: usersByRole,
          active: activeUsers,
          new: newUsers,
          newChange: parseFloat(newUsersChange),
          byKnowledgeSource: trafficSource,
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

