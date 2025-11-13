import MealPlan from '../models/MealPlan.js';
import Recipe from '../models/Recipe.js';
import User from '../models/User.model.js';
import Goal from '../models/Goal.js';

// Helper function to calculate BMR and daily calories
// @param {Object} profile - User profile with weight, height, age, gender, workHabits
// @param {String} userId - User ID (optional)
// @param {Boolean} useGoalCalories - If true, use goal's target calories instead of BMR (default: false)
const calculateDailyCalories = async (profile, userId = null, useGoalCalories = false) => {
  const { weight, height, age, gender, workHabits } = profile;
  
  // Check if user wants to use goal-based calories (for tracking page)
  if (useGoalCalories && userId) {
    const activeGoal = await Goal.findOne({ userId, status: 'active' });
    if (activeGoal && activeGoal.targetCaloriesPerDay) {
      console.log(`Using goal-based calories: ${activeGoal.targetCaloriesPerDay} cal/day`);
      return activeGoal.targetCaloriesPerDay;
    }
  }
  
  // Calculate BMR using Mifflin-St Jeor Equation (for meal plan page)
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
  
  console.log(`Using BMR-based calories: ${dailyCalories} cal/day`);
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
    const { date, startDate, endDate, forGoal } = req.query;
    
    let query = { userId: req.user._id };
    
    // NEW: Filter by meal plan type
    // forGoal = 'true' -> Get goal-based meal plans (Tracking Page)
    // forGoal = 'false' -> Get health-based meal plans (Meal Plan Page)
    // forGoal = undefined -> Get all meal plans
    if (forGoal === 'true') {
      query.goalId = { $ne: null }; // Has goalId
    } else if (forGoal === 'false') {
      query.goalId = null; // No goalId (health-based)
    }
    
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
    const { date, useGoalCalories = false, goalId = null } = req.body;
    
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
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies, eatingHabits } = user.profile;
    
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
    // useGoalCalories = true: Use goal-based calories (Tracking Page)
    // useGoalCalories = false: Use BMR-based calories (Meal Plan Page)
    const dailyCalories = await calculateDailyCalories(user.profile, req.user._id, useGoalCalories);
    
    // Map meal preferences to meal types
    const mealTypes = meals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = meals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    const dietQuery = diet && diet !== 'none' ? { tags: diet } : {};
    const allergiesQuery = allergies && allergies.length > 0
      ? { 'ingredients.name': { $nin: allergies } }
      : {};
    
    // Calculate calories per meal based on eating habits
    const caloriesPerMeal = Math.round(dailyCalories / meals.length);
    
    // Determine dishes per meal based on eating habits and calories
    const getDishesPerMeal = (eatingHabit, mealCalories) => {
      // Heavy eaters or high calorie meals -> 2 dishes
      if (eatingHabit === 'heavy' || mealCalories > 600) {
        return 2;
      }
      // Light eaters or low calorie meals -> 1 dish
      if (eatingHabit === 'light' || mealCalories < 400) {
        return 1;
      }
      // Snackers -> prefer more smaller dishes
      if (eatingHabit === 'snacker') {
        return mealCalories > 500 ? 2 : 1;
      }
      // Moderate eaters -> 1-2 dishes based on calories
      return mealCalories > 500 ? 2 : 1;
    };
    
    // Fetch recipes for each meal type with smart dish count
    const mealPlans = [];
    
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      const targetMealCalories = caloriesPerMeal;
      
      // Determine how many dishes for this meal
      const dishesCount = getDishesPerMeal(eatingHabits || 'moderate', targetMealCalories);
      const caloriesPerDish = Math.round(targetMealCalories / dishesCount);
      
      // Query recipes with case-insensitive tag matching
      const normalizedTag = mealTag.toLowerCase();
      const tagQuery = { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') }, status: 'published' };
      
      // Fetch more recipes to find ones with appropriate calorie range
      const recipesForMealType = await Recipe.aggregate([
        { $match: { ...dietQuery, ...allergiesQuery, ...tagQuery } },
        { $sample: { size: Math.min(10, dishesCount * 3) } } // Get multiple options
      ]);
      
      if (recipesForMealType.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType} (${mealTag})`
        });
      }
      
      // Sort recipes by how close their calories are to target per dish
      const sortedRecipes = recipesForMealType.sort((a, b) => {
        const aCalories = a.nutrition?.calories || 0;
        const bCalories = b.nutrition?.calories || 0;
        const aDiff = Math.abs(aCalories - caloriesPerDish);
        const bDiff = Math.abs(bCalories - caloriesPerDish);
        return aDiff - bDiff;
      });
      
      // Select the best matching recipes
      const selectedRecipes = sortedRecipes.slice(0, dishesCount);
      
      // Add recipes to meal plan
      for (const recipe of selectedRecipes) {
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
    
    // Check if meal plan already exists for this date and goalId
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const query = {
      userId: req.user._id,
      date: {
        $gte: targetDate,
        $lt: nextDay
      }
    };
    
    // CRITICAL: Filter by goalId to separate goal-based and health-based meal plans
    if (goalId) {
      query.goalId = goalId; // Find goal-based meal plan
    } else {
      query.goalId = null; // Find health-based meal plan
    }
    
    // Use findOneAndUpdate with upsert to avoid duplicates
    const mealPlan = await MealPlan.findOneAndUpdate(
      query,
      {
        goalId, // Save goalId to distinguish goal-based vs health-based meal plans
        meals: mealPlans,
        totalCalories,
        totalMacros,
        targetCalories: dailyCalories
      },
      { new: true, upsert: true } // Create if not found, update if exists
    ).populate('meals.recipeId', 'name image description');
    
    res.status(201).json({
      success: true,
      data: mealPlan
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
    const { date, useGoalCalories = false, goalId = null } = req.body;
    
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
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies, eatingHabits } = user.profile;
    
    // Calculate daily calories
    // useGoalCalories = true: Use goal-based calories (Tracking Page)
    // useGoalCalories = false: Use BMR-based calories (Meal Plan Page)
    const dailyCalories = await calculateDailyCalories(user.profile, req.user._id, useGoalCalories);
    
    // Use default meals if not set
    const userMeals = meals && meals.length > 0 ? meals : ['breakfast', 'lunch', 'dinner'];
    const mealTypes = userMeals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = userMeals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    const dietQuery = diet && diet !== 'none' ? { tags: diet } : {};
    const allergiesQuery = allergies && allergies.length > 0
      ? { 'ingredients.name': { $nin: allergies } }
      : {};
    
    // Calculate calories per meal
    const caloriesPerMeal = Math.round(dailyCalories / userMeals.length);
    
    // Determine dishes per meal based on eating habits and calories
    const getDishesPerMeal = (eatingHabit, mealCalories) => {
      if (eatingHabit === 'heavy' || mealCalories > 600) {
        return 2;
      }
      if (eatingHabit === 'light' || mealCalories < 400) {
        return 1;
      }
      if (eatingHabit === 'snacker') {
        return mealCalories > 500 ? 2 : 1;
      }
      return mealCalories > 500 ? 2 : 1;
    };
    
    // Fetch new recipes with smart dish count
    const newMeals = [];
    
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      const targetMealCalories = caloriesPerMeal;
      
      const dishesCount = getDishesPerMeal(eatingHabits || 'moderate', targetMealCalories);
      const caloriesPerDish = Math.round(targetMealCalories / dishesCount);
      
      const normalizedTag = mealTag.toLowerCase();
      const tagQuery = { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') }, status: 'published' };
      
      const recipesForMealType = await Recipe.aggregate([
        { $match: { ...dietQuery, ...allergiesQuery, ...tagQuery } },
        { $sample: { size: Math.min(10, dishesCount * 3) } }
      ]);
      
      if (recipesForMealType.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType}`
        });
      }
      
      // Sort by calorie proximity to target
      const sortedRecipes = recipesForMealType.sort((a, b) => {
        const aCalories = a.nutrition?.calories || 0;
        const bCalories = b.nutrition?.calories || 0;
        const aDiff = Math.abs(aCalories - caloriesPerDish);
        const bDiff = Math.abs(bCalories - caloriesPerDish);
        return aDiff - bDiff;
      });
      
      const selectedRecipes = sortedRecipes.slice(0, dishesCount);
      
      for (const recipe of selectedRecipes) {
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
    
    // Find and update existing meal plan (must match goalId to avoid cross-contamination)
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Build query to find meal plan with matching goalId
    const query = {
      userId: req.user._id,
      date: {
        $gte: targetDate,
        $lt: nextDay
      }
    };
    
    // CRITICAL: Filter by goalId to separate goal-based and health-based meal plans
    if (goalId) {
      query.goalId = goalId; // Find goal-based meal plan
    } else {
      query.goalId = null; // Find health-based meal plan
    }
    const mealPlan = await MealPlan.findOneAndUpdate(
      query,
      {
        goalId, // Update goalId
        meals: newMeals,
        totalCalories,
        totalMacros,
        targetCalories: dailyCalories
      },
      { new: true, upsert: true } // Create if not found
    ).populate('meals.recipeId', 'name image description');
    
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
    const { startDate, useGoalCalories = false } = req.body;
    
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
    
    const { weight, height, age, gender, workHabits, meals, diet, allergies, eatingHabits } = user.profile;
    
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
    // useGoalCalories = true: Use goal-based calories (Tracking Page)
    // useGoalCalories = false: Use BMR-based calories (Meal Plan Page)
    const dailyCalories = await calculateDailyCalories(user.profile, req.user._id, useGoalCalories);
    
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

// @desc    Delete all meal plans for a user (used when canceling goal)
// @route   DELETE /api/mealplans/user/all
// @access  Private
export const deleteAllUserMealPlans = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build query
    const query = { userId: req.user._id };
    
    // Optionally filter by date range (e.g., only delete meal plans during goal period)
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    const result = await MealPlan.deleteMany(query);
    
    res.status(200).json({
      success: true,
      message: `Đã xóa ${result.deletedCount} kế hoạch bữa ăn`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all meal plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa kế hoạch bữa ăn',
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



