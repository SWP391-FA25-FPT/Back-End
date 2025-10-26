import { SearchAnalytics } from '../models/Analytics.js';
import Recipe from '../models/Recipe.js';

// @desc    Track search query/keyword
// @route   POST /api/analytics/search
// @access  Public
export const trackSearch = async (req, res) => {
  try {
    const { keyword } = req.body;

    if (!keyword || keyword.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp từ khóa tìm kiếm'
      });
    }

    const normalizedKeyword = keyword.trim().toLowerCase();

    // Tìm và cập nhật hoặc tạo mới
    const existingSearch = await SearchAnalytics.findOne({ 
      keyword: normalizedKeyword 
    });

    if (existingSearch) {
      existingSearch.searchCount += 1;
      existingSearch.lastSearched = Date.now();
      await existingSearch.save();
    } else {
      await SearchAnalytics.create({
        keyword: normalizedKeyword,
        searchCount: 1,
        lastSearched: Date.now()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã lưu thông tin tìm kiếm'
    });
  } catch (error) {
    console.error('Track search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lưu thông tin tìm kiếm'
    });
  }
};

// @desc    Get trending tags with representative recipe images
// @route   GET /api/analytics/trending-tags
// @access  Public
export const getTrendingTags = async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    const limitNum = parseInt(limit);

    // Lấy các tags được search nhiều nhất
    const trendingSearches = await SearchAnalytics.find()
      .sort({ searchCount: -1, lastSearched: -1 })
      .limit(limitNum * 2); // Lấy nhiều hơn để filter

    if (!trendingSearches || trendingSearches.length === 0) {
      // Nếu chưa có search analytics, lấy các tags phổ biến từ recipes
      const recipes = await Recipe.find().select('tags');
      
      // Đếm số lần xuất hiện của mỗi tag
      const tagCounts = {};
      recipes.forEach(recipe => {
        if (recipe.tags && Array.isArray(recipe.tags)) {
          recipe.tags.forEach(tag => {
            const normalizedTag = tag.toLowerCase().trim();
            tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1;
          });
        }
      });

      // Sắp xếp và lấy top tags
      const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limitNum)
        .map(([tag]) => tag);

      // Lấy recipe đại diện cho mỗi tag
      const trendingTags = await Promise.all(
        sortedTags.map(async (tag) => {
          const recipe = await Recipe.findOne({ 
            tags: { $regex: new RegExp(`^${tag}$`, 'i') } 
          })
          .sort({ views: -1 })
          .select('name image views _id');

          return {
            name: tag,
            searchCount: tagCounts[tag],
            image: recipe ? recipe.image : '',
            recipeId: recipe ? recipe._id : null,
            recipeName: recipe ? recipe.name : ''
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: trendingTags.filter(tag => tag.image) // Chỉ trả về tags có ảnh
      });
    }

    // Lấy recipe đại diện cho mỗi keyword (từ search analytics)
    const trendingTagsWithImages = await Promise.all(
      trendingSearches.map(async (search) => {
        // Tìm recipe có tag match với keyword hoặc name match
        const recipe = await Recipe.findOne({
          $or: [
            { tags: { $regex: new RegExp(search.keyword, 'i') } },
            { name: { $regex: new RegExp(search.keyword, 'i') } }
          ]
        })
        .sort({ views: -1 }) // Lấy recipe có views cao nhất
        .select('name image views _id');

        if (recipe) {
          return {
            name: search.keyword,
            searchCount: search.searchCount,
            image: recipe.image,
            recipeId: recipe._id,
            recipeName: recipe.name
          };
        }
        return null;
      })
    );

    // Filter ra null và giới hạn số lượng
    const validTrendingTags = trendingTagsWithImages
      .filter(tag => tag !== null)
      .slice(0, limitNum);

    res.status(200).json({
      success: true,
      data: validTrendingTags
    });
  } catch (error) {
    console.error('Get trending tags error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy trending tags'
    });
  }
};

// @desc    Get search statistics (admin use)
// @route   GET /api/analytics/search-stats
// @access  Public (có thể thêm protection sau)
export const getSearchStats = async (req, res) => {
  try {
    const totalSearches = await SearchAnalytics.countDocuments();
    const topSearches = await SearchAnalytics.find()
      .sort({ searchCount: -1 })
      .limit(20)
      .select('keyword searchCount lastSearched');

    res.status(200).json({
      success: true,
      data: {
        totalSearches,
        topSearches
      }
    });
  } catch (error) {
    console.error('Get search stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê tìm kiếm'
    });
  }
};

