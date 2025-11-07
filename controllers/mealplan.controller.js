import MealPlan from '../models/MealPlan.js';
import Recipe from '../models/Recipe.js';
import User from '../models/User.model.js';

// Helper function to calculate BMR and daily calories
const calculateDailyCalories = (profile) => {
  const { weight, height, age, gender, workHabits } = profile;
  
  // Calculate BMR using Mifflin-St Jeor Equation
  const bmr = gender.toLowerCase() === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // Activity multipliers
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    'very active': 1.9
  };

  const normalizedWorkHabits = workHabits.toLowerCase();
  const dailyCalories = Math.round(bmr * (activityMultipliers[normalizedWorkHabits] || 1.2));
  
  return dailyCalories;
};

// Mapping from English meal types to Vietnamese tags
const mealsMap = {
  breakfast: 'bữa sáng',
  lunch: 'bữa trưa',
  dinner: 'bữa tối',
  snack: 'đồ ăn vặt'
};

// @desc    Get meal plans by date or date range
// @route   GET /api/mealplans
// @access  Private
export const getMealPlans = async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    
    let query = { userId: req.user._id };
    
    if (date) {
      // Single date query
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      query.date = {
        $gte: targetDate,
        $lt: nextDay
      };
    } else if (startDate && endDate) {
      // Date range query
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      // Return today's meal plan by default
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      query.date = {
        $gte: today,
        $lt: tomorrow
      };
    }
    
    const mealPlans = await MealPlan.find(query)
      .populate('meals.recipeId', 'name image description')
      .sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      count: mealPlans.length,
      data: mealPlans
    });
  } catch (error) {
    console.error('Get meal plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy kế hoạch bữa ăn',
      details: error.message
    });
  }
};

// @desc    Generate meal plan for a specific date
// @route   POST /api/mealplans/generate
// @access  Private
export const generateMealPlan = async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp ngày'
      });
    }
    
    // Get user profile
    const user = await User.findById(req.user._id);
    
    if (!user || !user.profile) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng hoàn thiện hồ sơ trước khi tạo kế hoạch bữa ăn'
      });
    }
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Validate required profile fields
    const missingFields = [];
    if (!weight) missingFields.push('cân nặng');
    if (!height) missingFields.push('chiều cao');
    if (!age) missingFields.push('tuổi');
    if (!gender) missingFields.push('giới tính');
    if (!workHabits) missingFields.push('mức độ hoạt động');
    if (!meals || meals.length === 0) missingFields.push('sở thích bữa ăn');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Thiếu thông tin hồ sơ: ${missingFields.join(', ')}`
      });
    }
    
    // Calculate daily calories
    const dailyCalories = calculateDailyCalories(user.profile);
    
    // Map meal preferences to meal types
    const mealTypes = meals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = meals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    const dietQuery = diet && diet !== 'none' ? { tags: diet } : {};
    const allergiesQuery = allergies && allergies.length > 0
      ? { 'ingredients.name': { $nin: allergies } }
      : {};
    
    // Fetch recipes for each meal type
    const mealPlans = [];
    const recipesPerMeal = 2;
    
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      
      // Query recipes with case-insensitive tag matching
      const normalizedTag = mealTag.toLowerCase();
      const tagQuery = { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') }, status: 'published' };
      
      const recipesForMealType = await Recipe.aggregate([
        { $match: { ...dietQuery, ...allergiesQuery, ...tagQuery } },
        { $sample: { size: recipesPerMeal } }
      ]);
      
      if (recipesForMealType.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType} (${mealTag})`
        });
      }
      
      // Add recipes to meal plan
      for (const recipe of recipesForMealType) {
        mealPlans.push({
          type: mealType,
          recipeId: recipe._id,
          name: recipe.name,
          calories: recipe.nutrition?.calories || 0,
          macros: {
            protein: recipe.nutrition?.protein || 0,
            carbs: recipe.nutrition?.carbs || 0,
            fat: recipe.nutrition?.fat || 0
          },
          imageUrl: recipe.image,
          ingredients: recipe.ingredients || []
        });
      }
    }
    
    // Calculate totals
    const totalCalories = mealPlans.reduce((sum, meal) => sum + meal.calories, 0);
    const totalMacros = mealPlans.reduce(
      (acc, meal) => ({
        protein: acc.protein + (meal.macros?.protein || 0),
        carbs: acc.carbs + (meal.macros?.carbs || 0),
        fat: acc.fat + (meal.macros?.fat || 0)
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    
    // Create meal plan
    const mealPlan = await MealPlan.create({
      userId: req.user._id,
      date: new Date(date),
      meals: mealPlans,
      totalCalories,
      totalMacros,
      targetCalories: dailyCalories
    });
    
    // Populate recipe details
    const populatedMealPlan = await MealPlan.findById(mealPlan._id)
      .populate('meals.recipeId', 'name image description');
    
    res.status(201).json({
      success: true,
      data: populatedMealPlan
    });
  } catch (error) {
    console.error('Generate meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo kế hoạch bữa ăn',
      details: error.message
    });
  }
};

// @desc    Regenerate meal plan for a specific date
// @route   POST /api/mealplans/regenerate
// @access  Private
export const regenerateMealPlan = async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp ngày'
      });
    }
    
    // Get user profile
    const user = await User.findById(req.user._id);
    
    if (!user || !user.profile) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng hoàn thiện hồ sơ'
      });
    }
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Calculate daily calories
    const dailyCalories = calculateDailyCalories(user.profile);
    
    // Use default meals if not set
    const userMeals = meals && meals.length > 0 ? meals : ['breakfast', 'lunch', 'dinner'];
    const mealTypes = userMeals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = userMeals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    const dietQuery = diet && diet !== 'none' ? { tags: diet } : {};
    const allergiesQuery = allergies && allergies.length > 0
      ? { 'ingredients.name': { $nin: allergies } }
      : {};
    
    // Fetch new recipes
    const newMeals = [];
    const recipesPerMeal = 2;
    
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      
      const normalizedTag = mealTag.toLowerCase();
      const tagQuery = { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') }, status: 'published' };
      
      const recipesForMealType = await Recipe.aggregate([
        { $match: { ...dietQuery, ...allergiesQuery, ...tagQuery } },
        { $sample: { size: recipesPerMeal } }
      ]);
      
      if (recipesForMealType.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType}`
        });
      }
      
      // Use only the first recipe
      for (const recipe of recipesForMealType.slice(0, 1)) {
        newMeals.push({
          type: mealType,
          recipeId: recipe._id,
          name: recipe.name,
          calories: recipe.nutrition?.calories || 0,
          macros: {
            protein: recipe.nutrition?.protein || 0,
            carbs: recipe.nutrition?.carbs || 0,
            fat: recipe.nutrition?.fat || 0
          },
          imageUrl: recipe.image,
          ingredients: recipe.ingredients || []
        });
      }
    }
    
    // Calculate totals
    const totalCalories = newMeals.reduce((sum, meal) => sum + meal.calories, 0);
    const totalMacros = newMeals.reduce(
      (acc, meal) => ({
        protein: acc.protein + (meal.macros?.protein || 0),
        carbs: acc.carbs + (meal.macros?.carbs || 0),
        fat: acc.fat + (meal.macros?.fat || 0)
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    
    // Find and update existing meal plan
    const targetDate = new Date(date);
    const mealPlan = await MealPlan.findOneAndUpdate(
      { userId: req.user._id, date: targetDate },
      {
        meals: newMeals,
        totalCalories,
        totalMacros,
        targetCalories: dailyCalories
      },
      { new: true }
    ).populate('meals.recipeId', 'name image description');
    
    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy kế hoạch bữa ăn cho ngày này'
      });
    }
    
    res.status(200).json({
      success: true,
      data: mealPlan
    });
  } catch (error) {
    console.error('Regenerate meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo lại kế hoạch bữa ăn',
      details: error.message
    });
  }
};

// @desc    Generate weekly meal plan
// @route   POST /api/mealplans/weekly
// @access  Private
export const generateWeeklyMealPlan = async (req, res) => {
  try {
    const { startDate } = req.body;
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp ngày bắt đầu'
      });
    }
    
    // Get user profile
    const user = await User.findById(req.user._id);
    
    if (!user || !user.profile) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng hoàn thiện hồ sơ'
      });
    }
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Validate required fields
    const missingFields = [];
    if (!weight) missingFields.push('cân nặng');
    if (!height) missingFields.push('chiều cao');
    if (!age) missingFields.push('tuổi');
    if (!gender) missingFields.push('giới tính');
    if (!workHabits) missingFields.push('mức độ hoạt động');
    if (!meals || meals.length === 0) missingFields.push('sở thích bữa ăn');
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Thiếu thông tin hồ sơ: ${missingFields.join(', ')}`
      });
    }
    
    // Calculate daily calories
    const dailyCalories = calculateDailyCalories(user.profile);
    
    // Map meal preferences
    const mealTypes = meals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = meals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    const dietQuery = diet && diet !== 'none' ? { tags: diet } : {};
    const allergiesQuery = allergies && allergies.length > 0
      ? { 'ingredients.name': { $nin: allergies } }
      : {};
    
    // Pre-fetch recipes for each meal type
    const recipesByTag = {};
    for (let i = 0; i < mealTags.length; i++) {
      const mealTag = mealTags[i];
      const normalizedTag = mealTag.toLowerCase();
      const tagQuery = { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') }, status: 'published' };
      
      const recipesForTag = await Recipe.find({
        ...dietQuery,
        ...allergiesQuery,
        ...tagQuery
      }).limit(10);
      
      if (recipesForTag.length < 7) {
        return res.status(400).json({
          success: false,
          error: `Không đủ công thức cho ${mealTypes[i]} (cần ít nhất 7, tìm thấy ${recipesForTag.length})`
        });
      }
      
      recipesByTag[mealTag] = recipesForTag;
    }
    
    // Generate meal plans for 7 days
    const weeklyPlans = [];
    const usedRecipeIdsByDay = {};
    
    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      const dayKey = date.toISOString().split('T')[0];
      usedRecipeIdsByDay[dayKey] = new Set();
      
      const dailyMeals = [];
      
      for (let i = 0; i < mealTypes.length; i++) {
        const mealType = mealTypes[i];
        const mealTag = mealTags[i];
        
        // Get available recipes for this tag
        const availableRecipes = recipesByTag[mealTag].filter(
          r => !usedRecipeIdsByDay[dayKey].has(r._id.toString())
        );
        
        const recipe = availableRecipes.length > 0
          ? availableRecipes[Math.floor(Math.random() * availableRecipes.length)]
          : recipesByTag[mealTag][Math.floor(Math.random() * recipesByTag[mealTag].length)];
        
        dailyMeals.push({
          type: mealType,
          recipeId: recipe._id,
          name: recipe.name,
          calories: recipe.nutrition?.calories || 0,
          macros: {
            protein: recipe.nutrition?.protein || 0,
            carbs: recipe.nutrition?.carbs || 0,
            fat: recipe.nutrition?.fat || 0
          },
          imageUrl: recipe.image,
          ingredients: recipe.ingredients || []
        });
        
        usedRecipeIdsByDay[dayKey].add(recipe._id.toString());
      }
      
      const totalCalories = dailyMeals.reduce((sum, m) => sum + m.calories, 0);
      const totalMacros = dailyMeals.reduce(
        (acc, m) => ({
          protein: acc.protein + (m.macros?.protein || 0),
          carbs: acc.carbs + (m.macros?.carbs || 0),
          fat: acc.fat + (m.macros?.fat || 0)
        }),
        { protein: 0, carbs: 0, fat: 0 }
      );
      
      const mealPlan = await MealPlan.create({
        userId: req.user._id,
        date,
        meals: dailyMeals,
        totalCalories,
        totalMacros,
        targetCalories: dailyCalories
      });
      
      weeklyPlans.push(mealPlan);
    }
    
    res.status(201).json({
      success: true,
      message: 'Tạo kế hoạch bữa ăn tuần thành công',
      count: weeklyPlans.length,
      data: weeklyPlans
    });
  } catch (error) {
    console.error('Generate weekly meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo kế hoạch bữa ăn tuần',
      details: error.message
    });
  }
};

// @desc    Delete meal plan
// @route   DELETE /api/mealplans/:id
// @access  Private
export const deleteMealPlan = async (req, res) => {
  try {
    const mealPlan = await MealPlan.findById(req.params.id);
    
    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy kế hoạch bữa ăn'
      });
    }
    
    // Check if user owns this meal plan
    if (mealPlan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền xóa kế hoạch bữa ăn này'
      });
    }
    
    await MealPlan.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Xóa kế hoạch bữa ăn thành công'
    });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa kế hoạch bữa ăn',
      details: error.message
    });
  }
};

// @desc    Update meal plan (replace a specific meal)
// @route   PUT /api/mealplans/:id/meals/:mealIndex
// @access  Private
export const updateMealInPlan = async (req, res) => {
  try {
    const { id, mealIndex } = req.params;
    const { recipeId } = req.body;
    
    const mealPlan = await MealPlan.findById(id);
    
    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy kế hoạch bữa ăn'
      });
    }
    
    // Check ownership
    if (mealPlan.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền chỉnh sửa kế hoạch bữa ăn này'
      });
    }
    
    // Validate meal index
    const index = parseInt(mealIndex);
    if (isNaN(index) || index < 0 || index >= mealPlan.meals.length) {
      return res.status(400).json({
        success: false,
        error: 'Chỉ số bữa ăn không hợp lệ'
      });
    }
    
    // Get new recipe
    const newRecipe = await Recipe.findById(recipeId);
    
    if (!newRecipe) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy công thức'
      });
    }
    
    // Update the meal
    mealPlan.meals[index] = {
      type: mealPlan.meals[index].type,
      recipeId: newRecipe._id,
      name: newRecipe.name,
      calories: newRecipe.nutrition?.calories || 0,
      macros: {
        protein: newRecipe.nutrition?.protein || 0,
        carbs: newRecipe.nutrition?.carbs || 0,
        fat: newRecipe.nutrition?.fat || 0
      },
      imageUrl: newRecipe.image,
      ingredients: newRecipe.ingredients || []
    };
    
    // Recalculate totals
    mealPlan.totalCalories = mealPlan.meals.reduce((sum, meal) => sum + meal.calories, 0);
    mealPlan.totalMacros = mealPlan.meals.reduce(
      (acc, meal) => ({
        protein: acc.protein + (meal.macros?.protein || 0),
        carbs: acc.carbs + (meal.macros?.carbs || 0),
        fat: acc.fat + (meal.macros?.fat || 0)
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
    
    await mealPlan.save();
    
    const updatedMealPlan = await MealPlan.findById(id)
      .populate('meals.recipeId', 'name image description');
    
    res.status(200).json({
      success: true,
      data: updatedMealPlan
    });
  } catch (error) {
    console.error('Update meal in plan error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật bữa ăn',
      details: error.message
    });
  }
};



