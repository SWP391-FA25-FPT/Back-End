import Recipe from '../models/Recipe.js';
import Rating from '../models/Rating.js';
import { cloudinary } from '../config/cloudinary.js';
import { sendNotification } from '../utils/notificationService.js';

const getUserReactionType = (reactions = [], userId) => {
  if (!userId) return null;
  const userIdString = userId.toString();

  const matchedReaction = reactions.find((reaction) =>
    (reaction.users || []).some((u) => u.toString() === userIdString)
  );

  return matchedReaction ? matchedReaction.type : null;
};

const sanitizeReactions = (reactions = []) =>
  reactions.map((reaction) => ({
    type: reaction.type,
    count: reaction.count
  }));

const buildRecipeResponse = (recipeDoc, userId) => {
  if (!recipeDoc) return null;

  const recipeObj =
    typeof recipeDoc.toObject === 'function' ? recipeDoc.toObject() : { ...recipeDoc };

  const userReaction = getUserReactionType(recipeObj.reactions, userId);

  return {
    ...recipeObj,
    reactions: sanitizeReactions(recipeObj.reactions),
    userReaction
  };
};

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
        { type: 'delicious', count: 0, users: [] },
        { type: 'love', count: 0, users: [] },
        { type: 'fire', count: 0, users: [] }
      ]
    });

    if (recipeStatus === 'published') {
      await sendNotification({
        userId: req.user._id,
        type: 'recipe_publish',
        message: `Công thức "${recipe.name}" đã được lên sóng thành công!`,
        recipeId: recipe._id,
        actorId: req.user._id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Tạo công thức thành công',
      data: buildRecipeResponse(recipe, req.user?._id)
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
      data: recipes.map((recipe) => buildRecipeResponse(recipe)),
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
          data: buildRecipeResponse(recipe, userId)
        });
      }

      // Check if user has saved this recipe
      const User = (await import('../models/User.model.js')).default;
      const user = await User.findById(userId);
      
      console.log('Checking if user saved recipe...');
      console.log('User favorites:', user?.favorites);
      
      if (
        user &&
        user.favorites &&
        user.favorites.some((fav) => fav.toString() === recipe._id.toString())
      ) {
        // User has saved this recipe, allow access
        console.log('User has saved this recipe - allowing access');
        return res.status(200).json({
          success: true,
          data: buildRecipeResponse(recipe, userId)
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
      data: buildRecipeResponse(recipe, req.user?._id)
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

    const previousStatus = recipe.status;

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

    if (previousStatus !== 'published' && recipe.status === 'published') {
      await sendNotification({
        userId: recipe.authorId,
        type: 'recipe_publish',
        message: `Công thức "${recipe.name}" đã được lên sóng thành công!`,
        recipeId: recipe._id,
        actorId: req.user._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật công thức thành công',
      data: buildRecipeResponse(recipe, req.user?._id)
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
      minTrustScore,
      includeIngredients,
      excludeIngredients
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

    // Filter by ingredients - include
    if (includeIngredients) {
      const ingredientArray = Array.isArray(includeIngredients) 
        ? includeIngredients 
        : includeIngredients.split(',').map(ing => ing.trim());
      query['ingredients.name'] = { $in: ingredientArray };
    }

    // Filter by ingredients - exclude
    if (excludeIngredients) {
      const excludeArray = Array.isArray(excludeIngredients)
        ? excludeIngredients
        : excludeIngredients.split(',').map(ing => ing.trim());
      query['ingredients.name'] = { 
        ...(query['ingredients.name'] || {}),
        $nin: excludeArray 
      };
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
      data: recipes.map((recipe) => buildRecipeResponse(recipe)),
      verifiedRecipes: verifiedRecipes.map((recipe) => buildRecipeResponse(recipe)),
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
// @access  Private
export const addReaction = async (req, res) => {
  try {
    const { type } = req.body;
    const recipeId = req.params.id;
    const userId = req.user._id;

    const validReactionTypes = ['delicious', 'love', 'fire'];
    if (!type || !validReactionTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Loại reaction không hợp lệ. Chỉ chấp nhận: delicious, love, fire'
      });
    }

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    const userIdString = userId.toString();
    const reactionLabels = {
      delicious: 'Ngon',
      love: 'Yêu thích',
      fire: 'Tuyệt vời'
    };

    if (!Array.isArray(recipe.reactions)) {
      recipe.reactions = [];
    }

    const ensureReactionEntry = (reactionType) => {
      let entry = recipe.reactions.find((r) => r.type === reactionType);
      if (!entry) {
        entry = { type: reactionType, count: 0, users: [] };
        recipe.reactions.push(entry);
      } else if (!entry.users) {
        entry.users = [];
      }
      return entry;
    };

    const currentReactionEntry = recipe.reactions.find((reaction) =>
      (reaction.users || []).some((user) => user.toString() === userIdString)
    );

    let newUserReaction = null;

    if (currentReactionEntry && currentReactionEntry.type === type) {
      // Toggle off current reaction
      currentReactionEntry.users = currentReactionEntry.users.filter(
        (user) => user.toString() !== userIdString
      );
      currentReactionEntry.count = currentReactionEntry.users.length;
    } else {
      // Remove from previous reaction if exists
      if (currentReactionEntry) {
        currentReactionEntry.users = currentReactionEntry.users.filter(
          (user) => user.toString() !== userIdString
        );
        currentReactionEntry.count = currentReactionEntry.users.length;
      }

      const targetReaction = ensureReactionEntry(type);
      if (!targetReaction.users.some((user) => user.toString() === userIdString)) {
        targetReaction.users.push(userId);
        targetReaction.count = targetReaction.users.length;
      }
      newUserReaction = type;
    }

    recipe.markModified('reactions');
    await recipe.save({ validateBeforeSave: false });

    if (
      newUserReaction &&
      recipe.authorId &&
      recipe.authorId.toString() !== userIdString
    ) {
      const actorName = req.user.name || req.user.username || req.user.email;
      await sendNotification({
        userId: recipe.authorId,
        type: 'reaction',
        message: `${actorName} đã phản hồi "${reactionLabels[newUserReaction]}" cho công thức "${recipe.name}".`,
        actorId: userId,
        recipeId: recipe._id,
        metadata: { reactionType: newUserReaction }
      });
    }

    res.status(200).json({
      success: true,
      message: newUserReaction ? 'Đã ghi nhận phản hồi' : 'Đã bỏ phản hồi',
      data: {
        reactions: sanitizeReactions(recipe.reactions),
        userReaction: newUserReaction
      }
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
      data: drafts.map((recipe) => buildRecipeResponse(recipe, req.user._id)),
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
        data: paginatedRecipes.map((recipe) => buildRecipeResponse(recipe, req.user._id)),
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
      data: recipes.map((recipe) => buildRecipeResponse(recipe, req.user?._id)),
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

    const previousStatus = recipe.status;

    // Update status
    recipe.status = status;
    await recipe.save(); // This will trigger the pre-save validation

    if (previousStatus !== 'published' && recipe.status === 'published') {
      await sendNotification({
        userId: recipe.authorId,
        type: 'recipe_publish',
        message: `Công thức "${recipe.name}" đã được lên sóng thành công!`,
        recipeId: recipe._id,
        actorId: req.user._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: buildRecipeResponse(recipe, req.user?._id)
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
      data: recipes.map((recipe) => buildRecipeResponse(recipe, req.user?._id)),
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

// ==================== ADMIN FUNCTIONS ====================

// @desc    Get pending recipes for moderation (Admin only)
// @route   GET /api/recipes/admin/pending
// @access  Private (Admin only)
export const getPendingRecipesAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search, category } = req.query;

    // Build query for pending recipes (draft or private status, exclude rejected)
    let query = {};

    // Filter by specific status if provided
    if (status && ['draft', 'private'].includes(status)) {
      // Specific status filter, exclude rejected
      query.status = status;
    } else {
      // Default: get both draft and private (exclude rejected)
      query.$and = [
        {
          $or: [
            { status: 'draft' },
            { status: 'private' }
          ]
        },
        { status: { $ne: 'rejected' } }
      ];
    }

    // Search by name or description
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchConditions = [
        { name: searchRegex },
        { description: searchRegex }
      ];
      
      if (query.$and) {
        // If we have $and, add search condition to it
        query.$and.push({ $or: searchConditions });
      } else {
        // If status filter is specific, combine with $and
        const statusCondition = { status: query.status };
        delete query.status;
        query.$and = [
          statusCondition,
          { $or: searchConditions }
        ];
      }
    }

    // Filter by tags (category)
    if (category && category.trim()) {
      query.tags = { $in: [category.trim()] };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Recipe.countDocuments(query);

    // Get recipes with pagination
    const recipes = await Recipe.find(query)
      .populate('authorId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: recipes.map((recipe) => buildRecipeResponse(recipe, req.user?._id)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get pending recipes admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách recipes chờ duyệt'
    });
  }
};

// @desc    Approve recipe (Admin only)
// @route   PUT /api/recipes/admin/:id/approve
// @access  Private (Admin only)
export const approveRecipeAdmin = async (req, res) => {
  try {
    const recipeId = req.params.id;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Update recipe status to published
    recipe.status = 'published';
    recipe.publishedAt = new Date();
    await recipe.save();

    // Send notification to author if exists
    if (recipe.authorId) {
      await sendNotification({
        userId: recipe.authorId,
        type: 'system',
        title: 'Công thức của bạn đã được duyệt',
        message: `Công thức "${recipe.name}" đã được duyệt và xuất bản thành công.`,
        actorId: req.user._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã duyệt công thức thành công',
      data: buildRecipeResponse(recipe, req.user?._id)
    });
  } catch (error) {
    console.error('Approve recipe admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi duyệt công thức'
    });
  }
};

// @desc    Reject recipe (Admin only)
// @route   PUT /api/recipes/admin/:id/reject
// @access  Private (Admin only)
export const rejectRecipeAdmin = async (req, res) => {
  try {
    const recipeId = req.params.id;
    const { reason } = req.body;

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Update recipe status to rejected
    recipe.status = 'rejected';
    recipe.rejectionReason = reason || '';
    recipe.rejectedAt = new Date();
    await recipe.save();

    // Send notification to author if exists
    if (recipe.authorId) {
      await sendNotification({
        userId: recipe.authorId,
        type: 'system',
        title: 'Công thức của bạn đã bị từ chối',
        message: `Công thức "${recipe.name}" đã bị từ chối.${reason ? ` Lý do: ${reason}` : ''}`,
        actorId: req.user._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Đã từ chối công thức thành công',
      data: buildRecipeResponse(recipe, req.user?._id)
    });
  } catch (error) {
    console.error('Reject recipe admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi từ chối công thức'
    });
  }
};

// @desc    Get moderation statistics (Admin only)
// @route   GET /api/recipes/admin/moderation/stats
// @access  Private (Admin only)
export const getModerationStatsAdmin = async (req, res) => {
  try {
    const pendingCount = await Recipe.countDocuments({
      $and: [
        { $or: [{ status: 'draft' }, { status: 'private' }] },
        { status: { $ne: 'rejected' } }
      ]
    });
    const draftCount = await Recipe.countDocuments({ status: 'draft' });
    const privateCount = await Recipe.countDocuments({ status: 'private' });
    const publishedCount = await Recipe.countDocuments({ status: 'published' });

    // Get recipes by priority (based on views or saves, exclude rejected)
    const highPriorityCount = await Recipe.countDocuments({
      $and: [
        { $or: [{ status: 'draft' }, { status: 'private' }] },
        { status: { $ne: 'rejected' } },
        {
          $or: [
            { views: { $gte: 100 } },
            { saves: { $gte: 50 } }
          ]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        pending: pendingCount,
        draft: draftCount,
        private: privateCount,
        published: publishedCount,
        highPriority: highPriorityCount
      }
    });
  } catch (error) {
    console.error('Get moderation stats admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê moderation'
    });
  }
};

// @desc    Get top recipes with filters
// @route   GET /api/recipes/top
// @access  Public
export const getTopRecipes = async (req, res) => {
  try {
    const {
      category,
      timeRange = 'all',
      sortBy = 'views',
      includeIngredients,
      excludeIngredients,
      minTrustScore,
      hasStepImages,
      page = 1,
      limit = 8
    } = req.query;

    // Build query
    const query = { status: 'published' };

    // Filter by category (tags)
    if (category && category !== 'all') {
      // Map category to tags
      const categoryMap = {
        'healthy': 'healthy',
        'weight-loss': 'Giảm cân',
        'muscle-gain': 'Tăng cơ',
        'vegetarian': 'Chay',
        'keto': 'Keto'
      };
      const tagValue = categoryMap[category] || category;
      query.tags = { $in: [tagValue] };
    }

    // Filter by time range - will be applied after date normalization in pipeline
    let timeRangeFilter = null;
    if (timeRange !== 'all') {
      const now = new Date();
      let startDate;
      
      if (timeRange === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      }
      
      if (startDate) {
        // Store for later use in pipeline after date normalization
        // Don't add to initial query since Extended JSON dates won't match
        timeRangeFilter = { createdAt: { $gte: startDate } };
      }
    }

    // Filter by ingredients - include and exclude
    if (includeIngredients || excludeIngredients) {
      const ingredientQuery = {};
      
      if (includeIngredients) {
        const ingredientArray = Array.isArray(includeIngredients)
          ? includeIngredients
          : includeIngredients.split(',').map(ing => ing.trim()).filter(ing => ing);
        if (ingredientArray.length > 0) {
          ingredientQuery.$in = ingredientArray;
        }
      }
      
      if (excludeIngredients) {
        const excludeArray = Array.isArray(excludeIngredients)
          ? excludeIngredients
          : excludeIngredients.split(',').map(ing => ing.trim()).filter(ing => ing);
        if (excludeArray.length > 0) {
          ingredientQuery.$nin = excludeArray;
        }
      }
      
      if (Object.keys(ingredientQuery).length > 0) {
        query['ingredients.name'] = ingredientQuery;
      }
    }

    // Filter by minimum trust score (premium)
    if (minTrustScore) {
      query.trustScore = { $gte: parseInt(minTrustScore) };
    }

    // Filter by has step images (premium)
    if (hasStepImages === 'true') {
      query['steps.image'] = { $exists: true, $ne: '' };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Aggregate to get recipes with ratings and likes
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'recipeId',
          as: 'ratings'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'authorInfo'
        }
      },
      {
        $addFields: {
          // Normalize createdAt from Extended JSON format to Date object
          createdAt: {
            $let: {
              vars: {
                // Extract date value if in Extended JSON format
                // Handle both regular Date objects and Extended JSON format
                dateValue: {
                  $cond: {
                    // If already a date, use it directly
                    if: { $eq: [{ $type: '$createdAt' }, 'date'] },
                    then: '$createdAt',
                    // If it's an object, might be Extended JSON format
                    else: {
                      $cond: {
                        if: { $eq: [{ $type: '$createdAt' }, 'object'] },
                        then: {
                          $let: {
                            vars: {
                              // Find the $date field by converting object to array
                              dateEntry: {
                                $arrayElemAt: [
                                  {
                                    $filter: {
                                      input: { $objectToArray: '$createdAt' },
                                      as: 'item',
                                      cond: { $eq: ['$$item.k', '$date'] }
                                    }
                                  },
                                  0
                                ]
                              }
                            },
                            in: {
                              $cond: {
                                if: { $ne: ['$$dateEntry', null] },
                                then: {
                                  $let: {
                                    vars: {
                                      dateField: '$$dateEntry.v'
                                    },
                                    in: {
                                      $cond: {
                                        // Check if dateField is an object with $numberLong
                                        if: {
                                          $and: [
                                            { $eq: [{ $type: '$$dateField' }, 'object'] },
                                            {
                                              $ne: [
                                                {
                                                  $arrayElemAt: [
                                                    {
                                                      $filter: {
                                                        input: { $objectToArray: '$$dateField' },
                                                        as: 'item',
                                                        cond: { $eq: ['$$item.k', '$numberLong'] }
                                                      }
                                                    },
                                                    0
                                                  ]
                                                },
                                                null
                                              ]
                                            }
                                          ]
                                        },
                                        then: {
                                          $let: {
                                            vars: {
                                              numberLongEntry: {
                                                $arrayElemAt: [
                                                  {
                                                    $filter: {
                                                      input: { $objectToArray: '$$dateField' },
                                                      as: 'item',
                                                      cond: { $eq: ['$$item.k', '$numberLong'] }
                                                    }
                                                  },
                                                  0
                                                ]
                                              }
                                            },
                                            in: {
                                              $toLong: '$$numberLongEntry.v'
                                            }
                                          }
                                        },
                                        else: '$$dateField'
                                      }
                                    }
                                  }
                                },
                                else: '$createdAt'
                              }
                            }
                          }
                        },
                        else: '$createdAt'
                      }
                    }
                  }
                }
              },
              in: {
                // Convert to Date, handling all formats safely
                $cond: {
                  // If already a date, use it directly
                  if: { $eq: [{ $type: '$$dateValue' }, 'date'] },
                  then: '$$dateValue',
                  else: {
                    // Try to convert to date
                    $convert: {
                      input: '$$dateValue',
                      to: 'date',
                      onError: {
                        // If conversion fails, try dateFromString for string dates
                        $cond: {
                          if: { $eq: [{ $type: '$$dateValue' }, 'string'] },
                          then: {
                            $dateFromString: {
                              dateString: '$$dateValue',
                              onError: { $dateFromParts: { year: 1970, month: 1, day: 1 } }
                            }
                          },
                          else: { $dateFromParts: { year: 1970, month: 1, day: 1 } }
                        }
                      },
                      onNull: { $dateFromParts: { year: 1970, month: 1, day: 1 } }
                    }
                  }
                }
              }
            }
          },
          // Calculate total likes from reactions
          likes: {
            $sum: {
              $map: {
                input: { $ifNull: ['$reactions', []] },
                as: 'reaction',
                in: { $ifNull: ['$$reaction.count', 0] }
              }
            }
          },
          // Calculate average rating
          rating: {
            $cond: {
              if: { $gt: [{ $size: '$ratings' }, 0] },
              then: {
                $divide: [
                  { $sum: '$ratings.rating' },
                  { $size: '$ratings' }
                ]
              },
              else: 0
            }
          },
          // Check if premium (trustScore >= 70 or has step images)
          isPremium: {
            $or: [
              { $gte: ['$trustScore', 70] },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ['$steps', []] },
                        as: 'step',
                        cond: { $ne: ['$$step.image', ''] }
                      }
                    }
                  },
                  0
                ]
              }
            ]
          },
          // Get author info - ensure name is always a string
          author: {
            $let: {
              vars: {
                author: { $arrayElemAt: ['$authorInfo', 0] }
              },
              in: {
                name: {
                  $toString: {
                    $ifNull: [
                      { $ifNull: ['$$author.name', null] },
                      { $ifNull: ['$author', 'Unknown'] }
                    ]
                  }
                },
                avatar: { $ifNull: ['$$author.profile.avatar', null] }
              }
            }
          }
        }
      },
      // Apply time range filter after date normalization if needed
      ...(timeRangeFilter ? [{ $match: timeRangeFilter }] : []),
      {
        $project: {
          _id: 1,
          id: { $toString: '$_id' },
          name: 1,
          description: 1,
          image: 1,
          views: { $ifNull: ['$views', 0] },
          likes: { $ifNull: ['$likes', 0] },
          rating: { $round: [{ $ifNull: ['$rating', 0] }, 1] },
          isPremium: 1,
          nutrition: { $ifNull: ['$nutrition', {}] },
          tags: { $ifNull: ['$tags', []] },
          category: { $arrayElemAt: ['$tags', 0] },
          // Use the author field already created in $addFields stage
          // Ensure name is always a string using $toString
          author: {
            $cond: {
              if: { $ne: ['$author', null] },
              then: {
                name: {
                  $toString: {
                    $ifNull: [
                      { $ifNull: ['$author.name', null] },
                      { $ifNull: ['$author', 'Unknown'] }
                    ]
                  }
                },
                avatar: '$author.avatar'
              },
              else: { name: 'Unknown', avatar: null }
            }
          },
          createdAt: {
            // createdAt is already normalized to Date in $addFields stage
            // Format it as string, with fallback if somehow not a date
            $cond: {
              if: { $eq: [{ $type: '$createdAt' }, 'date'] },
              then: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$createdAt'
                }
              },
              else: '1970-01-01' // Fallback string if not a date
            }
          },
          trustScore: 1
        }
      }
    ];

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      likes: { likes: -1 },
      rating: { rating: -1 }
    };
    const sortField = sortOptions[sortBy] || sortOptions.views;
    pipeline.push({ $sort: sortField });

    // Get total count before pagination
    const countPipeline = [...pipeline];
    const totalResult = await Recipe.aggregate([
      ...countPipeline,
      { $count: 'total' }
    ]);
    const total = totalResult[0]?.total || 0;

    // Apply pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    // Execute aggregation
    const recipes = await Recipe.aggregate(pipeline);

    // Calculate stats
    const statsPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalMealPlans: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLikes: {
            $sum: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$reactions', []] },
                  as: 'reaction',
                  in: { $ifNull: ['$$reaction.count', 0] }
                }
              }
            }
          }
        }
      }
    ];

    const statsResult = await Recipe.aggregate(statsPipeline);
    const stats = statsResult[0] || {
      totalMealPlans: 0,
      totalViews: 0,
      totalLikes: 0
    };

    // Calculate average rating
    const ratingMatchQuery = { 'recipe.status': 'published' };
    if (query.tags) {
      ratingMatchQuery['recipe.tags'] = query.tags;
    }
    if (query.createdAt) {
      ratingMatchQuery['recipe.createdAt'] = query.createdAt;
    }
    if (query['ingredients.name']) {
      ratingMatchQuery['recipe.ingredients.name'] = query['ingredients.name'];
    }
    if (query.trustScore) {
      ratingMatchQuery['recipe.trustScore'] = query.trustScore;
    }
    if (query['steps.image']) {
      ratingMatchQuery['recipe.steps.image'] = query['steps.image'];
    }

    const avgRatingResult = await Rating.aggregate([
      {
        $lookup: {
          from: 'recipes',
          localField: 'recipeId',
          foreignField: '_id',
          as: 'recipe'
        }
      },
      { $unwind: '$recipe' },
      { $match: ratingMatchQuery },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const averageRating = avgRatingResult[0]?.averageRating || 0;

    res.status(200).json({
      success: true,
      data: {
        mealPlans: recipes,
        stats: {
          totalMealPlans: stats.totalMealPlans,
          totalViews: stats.totalViews,
          totalLikes: stats.totalLikes,
          averageRating: Math.round(averageRating * 10) / 10
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get top recipes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy top recipes'
    });
  }
};