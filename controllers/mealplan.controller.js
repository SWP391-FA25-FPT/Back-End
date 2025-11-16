import MealPlan from '../models/MealPlan.js';
import Recipe from '../models/Recipe.js';
import User from '../models/User.model.js';
import Goal from '../models/Goal.js';

// Helper function to calculate age from dateOfBirth
const calculateAge = (age, dateOfBirth) => {
  if (age) return age;
  if (dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }
  return null;
};

// Helper function to calculate BMR and daily calories
// @param {Object} profile - User profile with weight, height, age, dateOfBirth, gender, workHabits
// @param {String} userId - User ID (optional)
// @param {Boolean} useGoalCalories - If true, use goal's target calories instead of BMR (default: false)
const calculateDailyCalories = async (profile, userId = null, useGoalCalories = false) => {
  const { weight, height, age, dateOfBirth, gender, workHabits } = profile;
  
  // Calculate age from dateOfBirth if age is not available
  const userAge = calculateAge(age, dateOfBirth);
  
  // Check if user wants to use goal-based calories (for tracking page)
  if (useGoalCalories && userId) {
    const activeGoal = await Goal.findOne({ userId, status: 'active' });
    if (activeGoal && activeGoal.targetCaloriesPerDay) {
      console.log(`Using goal-based calories: ${activeGoal.targetCaloriesPerDay} cal/day`);
      return activeGoal.targetCaloriesPerDay;
    }
  }
  
  // Calculate BMR using Mifflin-St Jeor Equation (for meal plan page)
  if (!userAge) {
    throw new Error('Age or dateOfBirth is required to calculate BMR');
  }
  
  const bmr = gender.toLowerCase() === 'male'
    ? 10 * weight + 6.25 * height - 5 * userAge + 5
    : 10 * weight + 6.25 * height - 5 * userAge - 161;  

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

// Helper function to select optimal recipes for a meal (1-2 dishes)
// Returns array of meal objects that maximize calories while staying under maxCalories
const selectOptimalMealRecipes = (recipes, maxCalories, mealType) => {
  console.log(`[SELECT] Starting selection for ${mealType}, maxCalories: ${maxCalories}, available recipes: ${recipes.length}`);
  
  if (!recipes || recipes.length === 0) {
    console.error(`[SELECT] No recipes provided for ${mealType}`);
    return [];
  }

  // Filter recipes with valid calories
  const validRecipes = recipes
    .map(r => ({
      ...r,
      calories: r.nutrition?.calories || 0
    }))
    .filter(r => r.calories > 0 && r.calories <= maxCalories) // Only consider recipes that fit
    .sort((a, b) => b.calories - a.calories); // Sort descending (prefer higher calories that fit)

  console.log(`[SELECT] Valid recipes (calories > 0 and <= ${maxCalories}): ${validRecipes.length}`);

  if (validRecipes.length === 0) {
    // No recipes fit - try to find smallest recipe available
    const allRecipes = recipes
      .map(r => ({
        ...r,
        calories: r.nutrition?.calories || 0
      }))
      .filter(r => r.calories > 0)
      .sort((a, b) => a.calories - b.calories); // Sort ascending to find smallest
    
    console.log(`[SELECT] All recipes with calories > 0: ${allRecipes.length}`);
    
    if (allRecipes.length > 0) {
      console.warn(`[WARN] No recipe fits maxCalories (${maxCalories}) for ${mealType}, using smallest available: ${allRecipes[0].name} (${allRecipes[0].calories} cal)`);
      // Debug: log nutrition data
      console.log('[SELECT] Recipe nutrition:', allRecipes[0].nutrition);
      return [{
        type: mealType,
        recipeId: allRecipes[0]._id,
        name: allRecipes[0].name,
        calories: allRecipes[0].calories,
        macros: {
          protein: allRecipes[0].nutrition?.protein || 0,
          carbs: allRecipes[0].nutrition?.carbs || 0,
          fat: allRecipes[0].nutrition?.fat || 0,
          fiber: allRecipes[0].nutrition?.fiber || 0,
          sugar: allRecipes[0].nutrition?.sugar || 0
        },
        imageUrl: allRecipes[0].image,
        ingredients: allRecipes[0].ingredients || []
      }];
    }
    
    // Log sample recipe to debug nutrition data
    if (recipes.length > 0) {
      console.error(`[ERROR] No recipes have valid calories! Sample recipe:`, {
        name: recipes[0].name,
        nutrition: recipes[0].nutrition,
        hasNutrition: !!recipes[0].nutrition,
        caloriesValue: recipes[0].nutrition?.calories
      });
    }
    
    return [];
  }

  let bestOption = null;
  let bestTotalCalories = 0;

  // Try 1-dish option (all recipes already filtered to fit maxCalories)
  if (validRecipes.length > 0) {
    bestOption = [validRecipes[0]]; // Highest calorie recipe that fits
    bestTotalCalories = validRecipes[0].calories;
  }

  // Try 2-dish combinations (only if maxCalories >= 200 to make it worthwhile)
  if (maxCalories >= 200 && validRecipes.length >= 2) {
    for (let i = 0; i < validRecipes.length; i++) {
      for (let j = i + 1; j < validRecipes.length; j++) {
        const total = validRecipes[i].calories + validRecipes[j].calories;
        // All recipes already filtered to fit individually, but check sum still fits
        if (total <= maxCalories && total > bestTotalCalories) {
          bestOption = [validRecipes[i], validRecipes[j]];
          bestTotalCalories = total;
        }
      }
    }
  }

  // Convert to meal format
  return bestOption.map(recipe => {
    // Debug: log nutrition data for first recipe
    if (bestOption.indexOf(recipe) === 0) {
      console.log(`[DEBUG] Recipe: ${recipe.name}, Nutrition:`, recipe.nutrition);
    }
    
    return {
      type: mealType,
      recipeId: recipe._id,
      name: recipe.name,
      calories: recipe.calories,
      macros: {
        protein: recipe.nutrition?.protein || 0,
        carbs: recipe.nutrition?.carbs || 0,
        fat: recipe.nutrition?.fat || 0,
        fiber: recipe.nutrition?.fiber || 0,
        sugar: recipe.nutrition?.sugar || 0
      },
      imageUrl: recipe.image,
      ingredients: recipe.ingredients || []
    };
  });
};

// Mapping from English meal types to Vietnamese tags
const mealsMap = {
  breakfast: 'sáng',
  lunch: 'trưa',
  dinner: 'tối',
  snack: 'chiều' // Bữa phụ ở giữa trưa và tối
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
    
    const { weight, height, age, dateOfBirth, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Calculate age from dateOfBirth if age is not available
    const userAge = calculateAge(age, dateOfBirth);
    
    // Validate required profile fields
    const missingFields = [];
    if (!weight) missingFields.push('cân nặng');
    if (!height) missingFields.push('chiều cao');
    if (!userAge) missingFields.push('tuổi (hoặc ngày sinh)');
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
    
    console.log(`[GENERATE] Daily calories: ${dailyCalories}, User meals: ${meals}, Diet: ${diet || 'none'}, Allergies: ${allergies || 'none'}`);
    
    // Sort meals to ensure snack is between lunch and dinner
    const sortedMeals = [...meals].sort((a, b) => {
      const order = { breakfast: 1, lunch: 2, snack: 3, dinner: 4 };
      return (order[a.toLowerCase()] || 99) - (order[b.toLowerCase()] || 99);
    });
    
    // Map meal preferences to meal types
    const mealTypes = sortedMeals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = sortedMeals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    console.log(`[GENERATE] Meal types: ${mealTypes.join(', ')}, Tags: ${mealTags.join(', ')}`);
    
    // Build recipe query
    // ONLY filter by diet for vegetarian/vegan (require "chay" tag)
    // Other diets (keto, paleo, etc.) are ignored
    let dietQuery = {};
    if (diet && diet !== 'none' && (diet === 'vegetarian' || diet === 'vegan')) {
      // Require "chay" tag for vegetarian/vegan diets only
      dietQuery.tags = { $regex: new RegExp('chay', 'i') };
    }
    
    // FIXED: Check if allergies is a valid array and not "Không"
    const allergiesQuery = 
      Array.isArray(allergies) && 
      allergies.length > 0 && 
      !allergies.includes('Không') && 
      !allergies.includes('không')
        ? { 'ingredients.name': { $nin: allergies } }
        : {};
    
    // Calculate calories per meal (distribute evenly, but allow flexibility)
    const caloriesPerMeal = Math.floor(dailyCalories / mealTypes.length);
    const mealPlansByType = {}; // Store meals by type to ensure each meal has at least 1 dish
    
    console.log(`[GENERATE] Calories per meal: ${caloriesPerMeal}`);

    
    // Fetch recipes for each meal type and select optimally
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      
      console.log(`\n[GENERATE] Processing meal ${i+1}/${mealTypes.length}: ${mealType} (${mealTag})`);
      
      // Build tag conditions - meal tag is required, "chay" tag is optional (vegetarian/vegan only)
      const normalizedTag = mealTag.toLowerCase();
      const tagConditions = [
        { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') } } // Meal tag (sáng, trưa, tối)
      ];
      
      // Add "chay" tag for vegetarian/vegan only
      if (dietQuery.tags && dietQuery.tags.$regex) {
        tagConditions.push({ tags: { $regex: dietQuery.tags.$regex } });
      }
      
      // Build final match query
      const matchQuery = {
        ...allergiesQuery,
        status: 'published'
      };
      
      // Use $and only if multiple tag conditions, otherwise use simple tags query
      if (tagConditions.length > 1) {
        matchQuery.$and = tagConditions;
      } else {
        matchQuery.tags = tagConditions[0].tags;
      }
      
      console.log(`[GENERATE] Match query:`, JSON.stringify(matchQuery, null, 2));
      
      // Fetch multiple recipes to have options (20 recipes for better selection)
      // Include nutrition fields in projection to ensure we get fiber and sugar
      const recipesForMealType = await Recipe.aggregate([
        { $match: matchQuery },
        { $sample: { size: 20 } },
        { $project: {
          name: 1,
          image: 1,
          ingredients: 1,
          nutrition: 1,
          _id: 1
        }}
      ]);
      
      console.log(`[GENERATE] Found ${recipesForMealType.length} recipes for ${mealType}`);
      
      if (recipesForMealType.length === 0) {
        console.error(`[ERROR] No recipes found for ${mealType} (${mealTag})`);
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType} (${mealTag})`,
          details: `Query: ${JSON.stringify(matchQuery)}`
        });
      }
      
      // Select optimal recipes for this meal (1-2 dishes) based on calories per meal
      // Try to get close to caloriesPerMeal but don't exceed
      console.log(`[GENERATE] Selecting optimal meals, max calories: ${caloriesPerMeal}`);
      const selectedMeals = selectOptimalMealRecipes(recipesForMealType, caloriesPerMeal, mealType);
      
      console.log(`[GENERATE] Selected ${selectedMeals.length} meals for ${mealType}`);
      
      if (selectedMeals.length === 0) {
        console.error(`[ERROR] No optimal meals selected for ${mealType}`);
        return res.status(400).json({
          success: false,
          error: `Không thể chọn món phù hợp cho ${mealType}`,
          details: `Calories per meal: ${caloriesPerMeal}, Available recipes: ${recipesForMealType.length}`
        });
      }
      
      // Store meals by type (ensure each meal type has at least 1 dish)
      mealPlansByType[mealType] = selectedMeals;
    }
    
    // Flatten all meals into single array
    const mealPlans = Object.values(mealPlansByType).flat();
    
    // Calculate totals
    let totalCalories = mealPlans.reduce((sum, meal) => sum + meal.calories, 0);
    let totalMacros = mealPlans.reduce(
      (acc, meal) => ({
        protein: acc.protein + (meal.macros?.protein || 0),
        carbs: acc.carbs + (meal.macros?.carbs || 0),
        fat: acc.fat + (meal.macros?.fat || 0),
        fiber: acc.fiber + (meal.macros?.fiber || 0),
        sugar: acc.sugar + (meal.macros?.sugar || 0)
      }),
      { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    );
    
    // CRITICAL: If total calories exceed target, reduce dishes from meals with 2 dishes to 1 dish
    // Ensure each meal type has at least 1 dish
    if (totalCalories > dailyCalories) {
      console.warn(`Warning: Total calories (${totalCalories}) exceeds target (${dailyCalories}), reducing dishes...`);
      
      // Find meals with 2 dishes and reduce to 1 dish (keep the one with higher calories)
      for (const mealType of Object.keys(mealPlansByType)) {
        const meals = mealPlansByType[mealType];
        if (meals.length > 1 && totalCalories > dailyCalories) {
          // Keep the dish with higher calories, remove the other
          meals.sort((a, b) => b.calories - a.calories); // Sort descending
          const removedMeal = meals.pop(); // Remove the one with lower calories
          totalCalories -= removedMeal.calories;
          totalMacros.protein -= removedMeal.macros?.protein || 0;
          totalMacros.carbs -= removedMeal.macros?.carbs || 0;
          totalMacros.fat -= removedMeal.macros?.fat || 0;
          totalMacros.fiber -= removedMeal.macros?.fiber || 0;
          totalMacros.sugar -= removedMeal.macros?.sugar || 0;
          console.log(`Reduced ${mealType}: removed ${removedMeal.name} (${removedMeal.calories} cal), kept ${meals[0].name}`);
        }
      }
      
      // Rebuild mealPlans array from mealPlansByType
      mealPlans.length = 0;
      mealPlans.push(...Object.values(mealPlansByType).flat());
      
      // Recalculate to be sure
      totalCalories = mealPlans.reduce((sum, meal) => sum + meal.calories, 0);
      totalMacros = mealPlans.reduce(
        (acc, meal) => ({
          protein: acc.protein + (meal.macros?.protein || 0),
          carbs: acc.carbs + (meal.macros?.carbs || 0),
          fat: acc.fat + (meal.macros?.fat || 0),
          fiber: acc.fiber + (meal.macros?.fiber || 0),
          sugar: acc.sugar + (meal.macros?.sugar || 0)
        }),
        { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
      );
      
      if (totalCalories > dailyCalories) {
        console.error(`ERROR: Still exceeds after reduction. This should not happen.`);
      } else {
        console.log(`✅ Adjusted total calories to ${totalCalories} (${((totalCalories / dailyCalories) * 100).toFixed(1)}% of target)`);
      }
    }
    
    // Ensure each meal type has at least 1 dish
    for (const mealType of mealTypes) {
      if (!mealPlansByType[mealType] || mealPlansByType[mealType].length === 0) {
        console.error(`ERROR: Meal type ${mealType} has no dishes!`);
      }
    }
    
    // Validate final total calories
    const caloriePercentage = (totalCalories / dailyCalories) * 100;
    if (totalCalories > dailyCalories) {
      console.error(`ERROR: Total calories (${totalCalories}) still exceeds target (${dailyCalories}) after adjustment`);
    } else if (caloriePercentage < 95) {
      console.warn(`Warning: Total calories (${totalCalories}) is only ${caloriePercentage.toFixed(1)}% of target (${dailyCalories})`);
    } else {
      console.log(`✅ Total calories (${totalCalories}) is ${caloriePercentage.toFixed(1)}% of target (${dailyCalories})`);
    }
    
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
    
    const { weight, height, age, dateOfBirth, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Calculate daily calories
    // useGoalCalories = true: Use goal-based calories (Tracking Page)
    // useGoalCalories = false: Use BMR-based calories (Meal Plan Page)
    const dailyCalories = await calculateDailyCalories(user.profile, req.user._id, useGoalCalories);
    
    // Use default meals if not set
    const userMeals = meals && meals.length > 0 ? meals : ['breakfast', 'lunch', 'dinner'];
    
    // Sort meals to ensure snack is between lunch and dinner
    const sortedMeals = [...userMeals].sort((a, b) => {
      const order = { breakfast: 1, lunch: 2, snack: 3, dinner: 4 };
      return (order[a.toLowerCase()] || 99) - (order[b.toLowerCase()] || 99);
    });
    
    const mealTypes = sortedMeals.map(meal => meal.charAt(0).toUpperCase() + meal.slice(1));
    const mealTags = sortedMeals.map(meal => mealsMap[meal.toLowerCase()] || meal);
    
    // Build recipe query
    // ONLY filter by diet for vegetarian/vegan (require "chay" tag)
    // Other diets (keto, paleo, etc.) are ignored
    let dietQuery = {};
    if (diet && diet !== 'none' && (diet === 'vegetarian' || diet === 'vegan')) {
      // Require "chay" tag for vegetarian/vegan diets only
      dietQuery.tags = { $regex: new RegExp('chay', 'i') };
    }
    
    // FIXED: Check if allergies is a valid array and not "Không"
    const allergiesQuery = 
      Array.isArray(allergies) && 
      allergies.length > 0 && 
      !allergies.includes('Không') && 
      !allergies.includes('không')
        ? { 'ingredients.name': { $nin: allergies } }
        : {};
    
    // Calculate calories per meal (distribute evenly, but allow flexibility)
    const caloriesPerMeal = Math.floor(dailyCalories / mealTypes.length);
    const mealPlansByType = {}; // Store meals by type to ensure each meal has at least 1 dish
    
    // Fetch recipes for each meal type and select optimally
    for (let i = 0; i < mealTypes.length; i++) {
      const mealType = mealTypes[i];
      const mealTag = mealTags[i];
      
      // Build tag conditions - meal tag is required, "chay" tag is optional (vegetarian/vegan only)
      const normalizedTag = mealTag.toLowerCase();
      const tagConditions = [
        { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') } } // Meal tag (sáng, trưa, tối)
      ];
      
      // Add "chay" tag for vegetarian/vegan only
      if (dietQuery.tags && dietQuery.tags.$regex) {
        tagConditions.push({ tags: { $regex: dietQuery.tags.$regex } });
      }
      
      // Build final match query
      const matchQuery = {
        ...allergiesQuery,
        status: 'published'
      };
      
      // Use $and only if multiple tag conditions, otherwise use simple tags query
      if (tagConditions.length > 1) {
        matchQuery.$and = tagConditions;
      } else {
        matchQuery.tags = tagConditions[0].tags;
      }
      
      // Fetch multiple recipes to have options (20 recipes for better selection)
      // Include nutrition fields in projection to ensure we get fiber and sugar
      const recipesForMealType = await Recipe.aggregate([
        { $match: matchQuery },
        { $sample: { size: 20 } },
        { $project: {
          name: 1,
          image: 1,
          ingredients: 1,
          nutrition: 1,
          _id: 1
        }}
      ]);
      
      if (recipesForMealType.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không tìm thấy công thức cho ${mealType} (${mealTag})`
        });
      }
      
      // Select optimal recipes for this meal (1-2 dishes) based on calories per meal
      // Try to get close to caloriesPerMeal but don't exceed
      const selectedMeals = selectOptimalMealRecipes(recipesForMealType, caloriesPerMeal, mealType);
      
      if (selectedMeals.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Không thể chọn món phù hợp cho ${mealType}`
        });
      }
      
      // Store meals by type (ensure each meal type has at least 1 dish)
      mealPlansByType[mealType] = selectedMeals;
    }
    
    // Flatten all meals into single array
    const newMeals = Object.values(mealPlansByType).flat();
    
    // Calculate totals
    let totalCalories = newMeals.reduce((sum, meal) => sum + meal.calories, 0);
    let totalMacros = newMeals.reduce(
      (acc, meal) => ({
        protein: acc.protein + (meal.macros?.protein || 0),
        carbs: acc.carbs + (meal.macros?.carbs || 0),
        fat: acc.fat + (meal.macros?.fat || 0),
        fiber: acc.fiber + (meal.macros?.fiber || 0),
        sugar: acc.sugar + (meal.macros?.sugar || 0)
      }),
      { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    );
    
    // CRITICAL: If total calories exceed target, reduce dishes from meals with 2 dishes to 1 dish
    // Ensure each meal type has at least 1 dish
    if (totalCalories > dailyCalories) {
      console.warn(`Warning: Total calories (${totalCalories}) exceeds target (${dailyCalories}), reducing dishes...`);
      
      // Find meals with 2 dishes and reduce to 1 dish (keep the one with higher calories)
      for (const mealType of Object.keys(mealPlansByType)) {
        const meals = mealPlansByType[mealType];
        if (meals.length > 1 && totalCalories > dailyCalories) {
          // Keep the dish with higher calories, remove the other
          meals.sort((a, b) => b.calories - a.calories); // Sort descending
          const removedMeal = meals.pop(); // Remove the one with lower calories
          totalCalories -= removedMeal.calories;
          totalMacros.protein -= removedMeal.macros?.protein || 0;
          totalMacros.carbs -= removedMeal.macros?.carbs || 0;
          totalMacros.fat -= removedMeal.macros?.fat || 0;
          totalMacros.fiber -= removedMeal.macros?.fiber || 0;
          totalMacros.sugar -= removedMeal.macros?.sugar || 0;
          console.log(`Reduced ${mealType}: removed ${removedMeal.name} (${removedMeal.calories} cal), kept ${meals[0].name}`);
        }
      }
      
      // Rebuild newMeals array from mealPlansByType
      newMeals.length = 0;
      newMeals.push(...Object.values(mealPlansByType).flat());
      
      // Recalculate to be sure
      totalCalories = newMeals.reduce((sum, meal) => sum + meal.calories, 0);
      totalMacros = newMeals.reduce(
        (acc, meal) => ({
          protein: acc.protein + (meal.macros?.protein || 0),
          carbs: acc.carbs + (meal.macros?.carbs || 0),
          fat: acc.fat + (meal.macros?.fat || 0),
          fiber: acc.fiber + (meal.macros?.fiber || 0),
          sugar: acc.sugar + (meal.macros?.sugar || 0)
        }),
        { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
      );
      
      if (totalCalories > dailyCalories) {
        console.error(`ERROR: Still exceeds after reduction. This should not happen.`);
      } else {
        console.log(`✅ Adjusted total calories to ${totalCalories} (${((totalCalories / dailyCalories) * 100).toFixed(1)}% of target)`);
      }
    }
    
    // Ensure each meal type has at least 1 dish
    for (const mealType of mealTypes) {
      if (!mealPlansByType[mealType] || mealPlansByType[mealType].length === 0) {
        console.error(`ERROR: Meal type ${mealType} has no dishes!`);
      }
    }
    
    // Validate final total calories
    const caloriePercentage = (totalCalories / dailyCalories) * 100;
    if (totalCalories > dailyCalories) {
      console.error(`ERROR: Total calories (${totalCalories}) still exceeds target (${dailyCalories}) after adjustment`);
    } else if (caloriePercentage < 95) {
      console.warn(`Warning: Total calories (${totalCalories}) is only ${caloriePercentage.toFixed(1)}% of target (${dailyCalories})`);
    } else {
      console.log(`✅ Total calories (${totalCalories}) is ${caloriePercentage.toFixed(1)}% of target (${dailyCalories})`);
    }
    
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
    
    const { weight, height, age, dateOfBirth, gender, workHabits, meals, diet, allergies } = user.profile;
    
    // Calculate age from dateOfBirth if age is not available
    const userAge = calculateAge(age, dateOfBirth);
    
    // Validate required fields
    const missingFields = [];
    if (!weight) missingFields.push('cân nặng');
    if (!height) missingFields.push('chiều cao');
    if (!userAge) missingFields.push('tuổi (hoặc ngày sinh)');
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
    // ONLY filter by diet for vegetarian/vegan (require "chay" tag)
    // Other diets (keto, paleo, etc.) are ignored
    let dietQuery = {};
    if (diet && diet !== 'none' && (diet === 'vegetarian' || diet === 'vegan')) {
      // Require "chay" tag for vegetarian/vegan diets only
      dietQuery.tags = { $regex: new RegExp('chay', 'i') };
    }
    
    // FIXED: Check if allergies is a valid array and not "Không"
    const allergiesQuery = 
      Array.isArray(allergies) && 
      allergies.length > 0 && 
      !allergies.includes('Không') && 
      !allergies.includes('không')
        ? { 'ingredients.name': { $nin: allergies } }
        : {};
    
    // Pre-fetch recipes for each meal type
    const recipesByTag = {};
    for (let i = 0; i < mealTags.length; i++) {
      const mealTag = mealTags[i];
      const normalizedTag = mealTag.toLowerCase();
      
      // Build tag conditions - meal tag is required, "chay" tag is optional (vegetarian/vegan only)
      const tagConditions = [
        { tags: { $regex: new RegExp(`^${normalizedTag}$`, 'i') } } // Meal tag (sáng, trưa, tối)
      ];
      
      // Add "chay" tag for vegetarian/vegan only
      if (dietQuery.tags && dietQuery.tags.$regex) {
        tagConditions.push({ tags: { $regex: dietQuery.tags.$regex } });
      }
      
      // Build final match query
      const matchQuery = {
        ...allergiesQuery,
        status: 'published'
      };
      
      // Use $and only if multiple tag conditions, otherwise use simple tags query
      if (tagConditions.length > 1) {
        matchQuery.$and = tagConditions;
      } else {
        matchQuery.tags = tagConditions[0].tags;
      }
      
      const recipesForTag = await Recipe.find(matchQuery)
        .select('name image ingredients nutrition _id').limit(10);
      
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
            fat: recipe.nutrition?.fat || 0,
            fiber: recipe.nutrition?.fiber || 0,
            sugar: recipe.nutrition?.sugar || 0
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
          fat: acc.fat + (m.macros?.fat || 0),
          fiber: acc.fiber + (m.macros?.fiber || 0),
          sugar: acc.sugar + (m.macros?.sugar || 0)
        }),
        { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
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
    const newRecipe = await Recipe.findById(recipeId).select('name image ingredients nutrition _id');
    
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
        fat: newRecipe.nutrition?.fat || 0,
        fiber: newRecipe.nutrition?.fiber || 0,
        sugar: newRecipe.nutrition?.sugar || 0
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
        fat: acc.fat + (meal.macros?.fat || 0),
        fiber: acc.fiber + (meal.macros?.fiber || 0),
        sugar: acc.sugar + (meal.macros?.sugar || 0)
      }),
      { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
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



