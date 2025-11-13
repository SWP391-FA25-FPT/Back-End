import Recipe from '../models/Recipe.js';
import { cloudinary } from '../config/cloudinary.js';

// @desc    Create new recipe
// @route   POST /api/recipes
// @access  Private (authenticated users)
export const createRecipe = async (req, res) => {
  try {
    const {
      name,
      description,
      totalTime,
      servings,
      tags,
      ingredients,
      steps,
      nutrition,
      tips,
      status
    } = req.body;

    // Validate based on status
    const recipeStatus = status || 'draft';
    
    if (recipeStatus === 'published') {
      // Validate required fields for published recipes
      if (!name || !description || !servings) {
        return res.status(400).json({
          success: false,
          error: 'Vui lòng cung cấp đầy đủ thông tin: tên, mô tả và số khẩu phần'
        });
      }
    }

    // Get main recipe image from uploaded files
    let mainImage = '';
    if (req.files && req.files.image && req.files.image[0]) {
      mainImage = req.files.image[0].path;
    }

    // Only require image for published recipes
    if (recipeStatus === 'published' && !mainImage) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng upload ảnh chính cho công thức'
      });
    }

    // Parse JSON fields if they are strings
    const parsedIngredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    const parsedNutrition = typeof nutrition === 'string' ? JSON.parse(nutrition) : nutrition;
    const parsedTips = typeof tips === 'string' ? JSON.parse(tips) : tips;

    // Map step images if uploaded
    if (req.files && req.files.stepImages && parsedSteps) {
      const stepImages = req.files.stepImages;
      parsedSteps.forEach((step, index) => {
        if (stepImages[index]) {
          step.image = stepImages[index].path;
        }
      });
    }

    // Create recipe with author from authenticated user
    const recipe = await Recipe.create({
      name: name || 'Món mới',
      author: req.user.name || req.user.email,
      authorId: req.user._id,
      description: description || '',
      image: mainImage || '',
      totalTime: totalTime || '',
      servings: servings || 1,
      tags: parsedTags || [],
      ingredients: parsedIngredients || [],
      steps: parsedSteps || [],
      nutrition: parsedNutrition || {},
      tips: parsedTips || [],
      status: recipeStatus,
      reactions: [
        { type: 'delicious', count: 0 },
        { type: 'love', count: 0 },
        { type: 'fire', count: 0 }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Tạo công thức thành công',
      data: recipe
    });
  } catch (error) {
    console.error('Create recipe error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tạo công thức'
    });
  }
};

// @desc    Get all recipes with pagination, search, and filter
// @route   GET /api/recipes
// @access  Public
export const getAllRecipes = async (req, res) => {
  try {
    const {
      search,
      tags,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      status,
      authorId
    } = req.query;

    // Build query
    const query = {};

    // Only show published recipes to public (unless specific status filter or authorId is provided)
    if (!status && !authorId) {
      query.status = 'published';
    } else if (status) {
      query.status = status;
    }

    // Filter by authorId (for user's own recipes)
    if (authorId) {
      query.authorId = authorId;
    }

    // Search by name (case-insensitive)
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      trustScore: { trustScore: -1 },
      createdAt: { createdAt: -1 }
    };
    const sort = sortOptions[sortBy] || sortOptions.createdAt;

    // Execute query
    const recipes = await Recipe.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Recipe.countDocuments(query);

    res.status(200).json({
      success: true,
      data: recipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get all recipes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách công thức'
    });
  }
};

// @desc    Get single recipe by ID
// @route   GET /api/recipes/:id
// @access  Public (with restrictions based on status)
export const getRecipeById = async (req, res) => {
  try {
    // Increment views using findByIdAndUpdate to avoid validation issues
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true, runValidators: false }
    );

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Check access permissions based on recipe status
    if (recipe.status !== 'published') {
      // For non-published recipes, check if user is the author or has saved the recipe
      const userId = req.user?._id;
      
      console.log('Recipe status:', recipe.status);
      console.log('User ID:', userId);
      console.log('Recipe authorId:', recipe.authorId);
      
      if (!userId) {
        console.log('No user ID - recipe is not public');
        return res.status(403).json({
          success: false,
          error: 'Công thức này không công khai'
        });
      }

      // Allow if user is the author (check if authorId exists)
      if (recipe.authorId && recipe.authorId.toString() === userId.toString()) {
        console.log('User is author - allowing access');
        return res.status(200).json({
          success: true,
          data: recipe
        });
      }

      // Check if user has saved this recipe
      const User = (await import('../models/User.model.js')).default;
      const user = await User.findById(userId);
      
      console.log('Checking if user saved recipe...');
      console.log('User favorites:', user?.favorites);
      
      if (user && user.favorites && user.favorites.some(fav => fav.toString() === recipe._id.toString())) {
        // User has saved this recipe, allow access
        console.log('User has saved this recipe - allowing access');
        return res.status(200).json({
          success: true,
          data: recipe
        });
      }

      // User is not author and hasn't saved the recipe
      console.log('Access denied - user is not author and has not saved recipe');
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền xem công thức này'
      });
    }

    // Recipe is published, allow access
    res.status(200).json({
      success: true,
      data: recipe
    });
  } catch (error) {
    console.error('Get recipe by ID error:', error);
    
    // Handle invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy công thức'
    });
  }
};

// @desc    Update recipe
// @route   PUT /api/recipes/:id
// @access  Private (author or admin only)
export const updateRecipe = async (req, res) => {
  try {
    let recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    const {
      name,
      description,
      totalTime,
      servings,
      tags,
      ingredients,
      steps,
      nutrition,
      tips,
      status
    } = req.body;

    // Update fields if provided
    if (name) recipe.name = name;
    if (description) recipe.description = description;
    if (totalTime) recipe.totalTime = totalTime;
    if (servings) recipe.servings = servings;
    
    // Update status (nếu có và hợp lệ)
    if (status && ['draft', 'private', 'published'].includes(status)) {
      recipe.status = status;
    }
    
    // Handle JSON fields
    if (tags) {
      recipe.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    }
    if (ingredients) {
      recipe.ingredients = typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients;
    }
    if (steps) {
      recipe.steps = typeof steps === 'string' ? JSON.parse(steps) : steps;
    }
    if (nutrition) {
      recipe.nutrition = typeof nutrition === 'string' ? JSON.parse(nutrition) : nutrition;
    }
    if (tips) {
      recipe.tips = typeof tips === 'string' ? JSON.parse(tips) : tips;
    }

    // Update main image if uploaded
    if (req.files && req.files.image && req.files.image[0]) {
      // Xóa ảnh cũ trên Cloudinary (nếu có)
      if (recipe.image && recipe.image.includes('cloudinary.com')) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = recipe.image.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = `Meta-Meal/recipes/${filename.split('.')[0]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log('Deleted old main image:', publicId);
        } catch (err) {
          console.error('Error deleting old main image:', err.message);
          // Không throw error, tiếp tục update
        }
      }
      
      recipe.image = req.files.image[0].path;
    }

    // Update step images if uploaded
    if (req.files && req.files.stepImages && recipe.steps) {
      const stepImages = req.files.stepImages;
      recipe.steps.forEach((step, index) => {
        if (stepImages[index]) {
          // Xóa ảnh cũ của step (nếu có)
          if (step.image && step.image.includes('cloudinary.com')) {
            try {
              const urlParts = step.image.split('/');
              const filename = urlParts[urlParts.length - 1];
              const publicId = `Meta-Meal/recipes/${filename.split('.')[0]}`;
              cloudinary.uploader.destroy(publicId).catch(err => 
                console.error('Error deleting old step image:', err.message)
              );
              console.log('Deleted old step image:', publicId);
            } catch (err) {
              console.error('Error processing old step image:', err.message);
            }
          }
          
          step.image = stepImages[index].path;
        }
      });
    }

    await recipe.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật công thức thành công',
      data: recipe
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật công thức'
    });
  }
};

// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private (author or admin only)
export const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    await recipe.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Xóa công thức thành công',
      data: {}
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi xóa công thức'
    });
  }
};

// @desc    Search recipes with advanced filters
// @route   GET /api/recipes/search
// @access  Public
export const searchRecipes = async (req, res) => {
  try {
    const {
      q,
      tags,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      minTrustScore
    } = req.query;

    // Build search query
    const query = {};

    // Search by keyword in name, description, or tags
    if (q && q.trim() !== '') {
      const searchRegex = { $regex: q.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: searchRegex }
      ];        
    }

    // Filter by specific tags
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Filter by minimum trust score
    if (minTrustScore) {
      query.trustScore = { $gte: parseInt(minTrustScore) };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      trustScore: { trustScore: -1 },
      createdAt: { createdAt: -1 },
      newest: { createdAt: -1 },
      popular: { views: -1 }
    };
    const sort = sortOptions[sortBy] || sortOptions.createdAt;

    // Execute query
    const recipes = await Recipe.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Recipe.countDocuments(query);

    // Get verified recipes (high trust score) for the search
    const verifiedRecipes = await Recipe.find({
      ...query,
      trustScore: { $gte: 70 }
    })
      .sort({ trustScore: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: recipes,
      verifiedRecipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      searchQuery: q || ''
    });
  } catch (error) {
    console.error('Search recipes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi tìm kiếm công thức'
    });
  }
};

// @desc    Add reaction to recipe
// @route   POST /api/recipes/:id/reactions
// @access  Public
export const addReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const recipeId = req.params.id;

    // Validate reaction type
    const validReactionTypes = ['delicious', 'love', 'fire'];
    if (!type || !validReactionTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Loại reaction không hợp lệ. Chỉ chấp nhận: delicious, love, fire'
      });
    }

    // Find recipe and update reaction count
    const recipe = await Recipe.findById(recipeId);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Find the reaction in array and increment
    const reactionIndex = recipe.reactions.findIndex(r => r.type === type);
    
    if (reactionIndex !== -1) {
      recipe.reactions[reactionIndex].count += 1;
    } else {
      // If reaction type doesn't exist, add it
      recipe.reactions.push({ type, count: 1 });
    }

    await recipe.save();

    res.status(200).json({
      success: true,
      message: 'Đã thêm reaction thành công',
      data: recipe.reactions
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi thêm reaction'
    });
  }
};

// @desc    Get user's drafts
// @route   GET /api/recipes/my/drafts
// @access  Private
export const getDraftsByUser = async (req, res) => {
  try {
    const drafts = await Recipe.find({
      authorId: req.user._id,
      status: 'draft'
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: drafts,
      count: drafts.length
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách drafts'
    });
  }
};

// @desc    Get user's recipes by status
// @route   GET /api/recipes/my/:statusType
// @access  Private
export const getMyRecipes = async (req, res) => {
  try {
    const { statusType } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Special handling for saved recipes
    if (statusType === 'saved') {
      return getSavedRecipes(req, res);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Special handling for "all" - include both user's recipes and saved recipes
    if (statusType === 'all') {
      // Get user's own recipes
      const userRecipes = await Recipe.find({ authorId: req.user._id })
        .sort({ updatedAt: -1 });

      // Get saved recipes
      const User = (await import('../models/User.model.js')).default;
      const user = await User.findById(req.user._id);
      
      let savedRecipes = [];
      if (user && user.favorites && user.favorites.length > 0) {
        savedRecipes = await Recipe.find({ 
          _id: { $in: user.favorites },
          authorId: { $ne: req.user._id } // Exclude user's own recipes from saved list
        }).sort({ updatedAt: -1 });
      }

      // Combine and sort by updatedAt
      const allRecipes = [...userRecipes, ...savedRecipes]
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      // Apply pagination
      const total = allRecipes.length;
      const paginatedRecipes = allRecipes.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        data: paginatedRecipes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    }

    // For other status types, filter by specific status
    let query = { authorId: req.user._id };

    if (statusType === 'drafts') {
      query.status = 'draft';
    } else if (statusType === 'private') {
      query.status = 'private';
    } else if (statusType === 'published') {
      query.status = 'published';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid status type'
      });
    }

    const recipes = await Recipe.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Recipe.countDocuments(query);

    res.status(200).json({
      success: true,
      data: recipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get my recipes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách recipes'
    });
  }
};

// @desc    Update recipe status
// @route   PATCH /api/recipes/:id/status
// @access  Private (author or admin)
export const updateRecipeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (!['draft', 'private', 'published'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status không hợp lệ. Chỉ chấp nhận: draft, private, published'
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Check ownership (check if authorId exists)
    if (recipe.authorId && recipe.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    // If recipe doesn't have authorId (old data), only admin can update
    if (!recipe.authorId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    // Update status
    recipe.status = status;
    await recipe.save(); // This will trigger the pre-save validation

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: recipe
    });
  } catch (error) {
    console.error('Update recipe status error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật trạng thái'
    });
  }
};

// @desc    Toggle save recipe (add/remove from favorites)
// @route   POST /api/recipes/:id/save
// @access  Private
export const toggleSaveRecipe = async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user._id;

    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Import User model
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy người dùng'
      });
    }

    // Check if recipe is already saved
    const isSaved = user.favorites.includes(recipeId);

    if (isSaved) {
      // Remove from favorites
      user.favorites = user.favorites.filter(id => id.toString() !== recipeId.toString());
      await user.save();

      // Decrement saves count using findByIdAndUpdate to avoid validation issues
      const updatedRecipe = await Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { saves: -1 } },
        { new: true, runValidators: false }
      );

      res.status(200).json({
        success: true,
        message: 'Đã bỏ lưu công thức',
        data: {
          isSaved: false,
          savesCount: Math.max(0, updatedRecipe.saves)
        }
      });
    } else {
      // Add to favorites
      user.favorites.push(recipeId);
      await user.save();

      // Increment saves count using findByIdAndUpdate to avoid validation issues
      const updatedRecipe = await Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { saves: 1 } },
        { new: true, runValidators: false }
      );

      res.status(200).json({
        success: true,
        message: 'Đã lưu công thức',
        data: {
          isSaved: true,
          savesCount: updatedRecipe.saves
        }
      });
    }
  } catch (error) {
    console.error('Toggle save recipe error:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lưu công thức'
    });
  }
};

// @desc    Get saved recipes
// @route   GET /api/recipes/my/saved
// @access  Private
export const getSavedRecipes = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    // Import User model
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(userId).populate('favorites');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy người dùng'
      });
    }

    // Get favorites with pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const totalFavorites = user.favorites.length;
    const paginatedFavorites = user.favorites.slice(skip, skip + limitNum);

    // Get full recipe details for paginated favorites
    const recipeIds = paginatedFavorites.map(fav => fav._id || fav);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: recipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalFavorites,
        pages: Math.ceil(totalFavorites / limitNum)
      }
    });
  } catch (error) {
    console.error('Get saved recipes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách recipes đã lưu'
    });
  }
};

// @desc    Check if recipe is saved by user
// @route   GET /api/recipes/:id/is-saved
// @access  Private
export const checkRecipeSaved = async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user._id;

    // Import User model
    const User = (await import('../models/User.model.js')).default;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy người dùng'
      });
    }

    const isSaved = user.favorites.some(id => id.toString() === recipeId.toString());

    res.status(200).json({
      success: true,
      data: {
        isSaved
      }
    });
  } catch (error) {
    console.error('Check recipe saved error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi kiểm tra trạng thái lưu'
    });
  }
};