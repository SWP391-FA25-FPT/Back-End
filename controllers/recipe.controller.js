import Recipe from '../models/Recipe.js';

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
      tips
    } = req.body;

    // Validate required fields
    if (!name || !description || !servings) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ thông tin: tên, mô tả và số khẩu phần'
      });
    }

    // Get main recipe image from uploaded files
    let mainImage = '';
    if (req.files && req.files.image && req.files.image[0]) {
      mainImage = req.files.image[0].path;
    }

    if (!mainImage) {
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
      name,
      author: req.user.name || req.user.email,
      authorId: req.user._id,
      description,
      image: mainImage,
      totalTime,
      servings,
      tags: parsedTags || [],
      ingredients: parsedIngredients || [],
      steps: parsedSteps || [],
      nutrition: parsedNutrition || {},
      tips: parsedTips || [],
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
      sortBy = 'createdAt'
    } = req.query;

    // Build query
    const query = {};

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
// @access  Public
export const getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }

    // Increment views
    recipe.views += 1;
    await recipe.save();

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
      tips
    } = req.body;

    // Update fields if provided
    if (name) recipe.name = name;
    if (description) recipe.description = description;
    if (totalTime) recipe.totalTime = totalTime;
    if (servings) recipe.servings = servings;
    
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
      recipe.image = req.files.image[0].path;
    }

    // Update step images if uploaded
    if (req.files && req.files.stepImages && recipe.steps) {
      const stepImages = req.files.stepImages;
      recipe.steps.forEach((step, index) => {
        if (stepImages[index]) {
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