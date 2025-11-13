// Health validation constants
const CALORIES_PER_KG = 7700; // Approximate calories in 1kg of body weight
const MAX_SAFE_WEIGHT_LOSS_PER_WEEK = 1; // kg
const MAX_SAFE_WEIGHT_GAIN_PER_WEEK = 0.5; // kg
const WARNING_WEIGHT_LOSS_PER_WEEK = 0.8; // kg - show warning above this
const WARNING_WEIGHT_GAIN_PER_WEEK = 0.4; // kg - show warning above this
const MIN_DAILY_CALORIES_FEMALE = 1200;
const MIN_DAILY_CALORIES_MALE = 1500;
const MAX_DAILY_CALORIE_DEFICIT = 1000;

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 */
export const calculateBMR = (weight, height, age, gender) => {
  if (gender.toLowerCase() === 'male') {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
};

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 */
export const calculateTDEE = (bmr, activityLevel) => {
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    'very active': 1.9
  };
  
  const multiplier = activityMultipliers[activityLevel?.toLowerCase()] || 1.2;
  return Math.round(bmr * multiplier);
};

/**
 * Calculate target daily calories based on goal
 */
export const calculateCalorieTarget = (tdee, weeklyWeightChange, gender) => {
  // Calculate daily calorie adjustment needed
  // weeklyWeightChange is negative for loss, positive for gain
  const dailyCalorieAdjustment = (weeklyWeightChange * CALORIES_PER_KG) / 7;
  
  let targetCalories = Math.round(tdee + dailyCalorieAdjustment);
  
  // Apply minimum calorie restrictions for safety
  const minCalories = gender.toLowerCase() === 'male' ? MIN_DAILY_CALORIES_MALE : MIN_DAILY_CALORIES_FEMALE;
  
  if (targetCalories < minCalories) {
    targetCalories = minCalories;
  }
  
  return targetCalories;
};

/**
 * Validate weight goal and generate warnings
 */
export const validateWeightGoal = (startWeight, targetWeight, durationWeeks, gender) => {
  const warnings = [];
  const errors = [];
  
  // Calculate weight change
  const totalWeightChange = targetWeight - startWeight;
  const weeklyWeightChange = totalWeightChange / durationWeeks;
  const absWeeklyChange = Math.abs(weeklyWeightChange);
  
  // Determine goal type
  let goalType = 'maintain';
  if (totalWeightChange < -0.1) {
    goalType = 'weight_loss';
  } else if (totalWeightChange > 0.1) {
    goalType = 'weight_gain';
  }
  
  // Validate weight loss goals
  if (goalType === 'weight_loss') {
    if (absWeeklyChange > MAX_SAFE_WEIGHT_LOSS_PER_WEEK) {
      errors.push(
        `Mục tiêu giảm ${absWeeklyChange.toFixed(1)}kg/tuần là quá nhanh và không an toàn cho sức khỏe. ` +
        `Tốc độ giảm cân tối đa khuyến nghị là ${MAX_SAFE_WEIGHT_LOSS_PER_WEEK}kg/tuần. ` +
        `Giảm cân quá nhanh có thể gây mất cơ, suy dinh dưỡng, rụng tóc, và các vấn đề sức khỏe nghiêm trọng khác.`
      );
    } else if (absWeeklyChange > WARNING_WEIGHT_LOSS_PER_WEEK) {
      warnings.push(
        `Mục tiêu giảm ${absWeeklyChange.toFixed(1)}kg/tuần hơi cao. ` +
        `Tốc độ giảm cân an toàn khuyến nghị là 0.5-0.8kg/tuần để bảo vệ sức khỏe và duy trì cơ bắp.`
      );
    }
    
    // Calculate minimum safe duration
    const minSafeDuration = Math.ceil(Math.abs(totalWeightChange) / MAX_SAFE_WEIGHT_LOSS_PER_WEEK);
    if (durationWeeks < minSafeDuration) {
      errors.push(
        `Để giảm ${Math.abs(totalWeightChange).toFixed(1)}kg một cách an toàn, ` +
        `bạn cần ít nhất ${minSafeDuration} tuần (khoảng ${Math.ceil(minSafeDuration / 4)} tháng).`
      );
    }
  }
  
  // Validate weight gain goals
  if (goalType === 'weight_gain') {
    if (absWeeklyChange > MAX_SAFE_WEIGHT_GAIN_PER_WEEK) {
      errors.push(
        `Mục tiêu tăng ${absWeeklyChange.toFixed(1)}kg/tuần là quá nhanh. ` +
        `Tốc độ tăng cân tối đa khuyến nghị là ${MAX_SAFE_WEIGHT_GAIN_PER_WEEK}kg/tuần để tăng cơ thay vì mỡ. ` +
        `Tăng cân quá nhanh thường dẫn đến tích tụ mỡ thừa và các vấn đề sức khỏe.`
      );
    } else if (absWeeklyChange > WARNING_WEIGHT_GAIN_PER_WEEK) {
      warnings.push(
        `Mục tiêu tăng ${absWeeklyChange.toFixed(1)}kg/tuần hơi cao. ` +
        `Tốc độ tăng cân an toàn khuyến nghị là 0.25-0.4kg/tuần để tăng cơ bắp, không phải mỡ.`
      );
    }
    
    // Calculate minimum safe duration
    const minSafeDuration = Math.ceil(Math.abs(totalWeightChange) / MAX_SAFE_WEIGHT_GAIN_PER_WEEK);
    if (durationWeeks < minSafeDuration) {
      errors.push(
        `Để tăng ${Math.abs(totalWeightChange).toFixed(1)}kg một cách lành mạnh, ` +
        `bạn cần ít nhất ${minSafeDuration} tuần (khoảng ${Math.ceil(minSafeDuration / 4)} tháng).`
      );
    }
  }
  
  // Validate minimum duration
  if (durationWeeks < 1) {
    errors.push('Thời gian thực hiện mục tiêu phải ít nhất 1 tuần.');
  }
  
  // Validate weight values
  if (startWeight <= 0 || targetWeight <= 0) {
    errors.push('Cân nặng phải là số dương.');
  }
  
  if (startWeight < 30 || targetWeight < 30) {
    errors.push('Cân nặng không hợp lệ. Vui lòng kiểm tra lại.');
  }
  
  return {
    isValid: errors.length === 0,
    goalType,
    weeklyWeightChange,
    warnings,
    errors
  };
};

/**
 * Generate health tips based on goal
 */
export const generateHealthTips = (goalType, weeklyWeightChange) => {
  const tips = [];
  
  if (goalType === 'weight_loss') {
    tips.push('💧 Uống đủ 2-3 lít nước mỗi ngày để hỗ trợ quá trình trao đổi chất');
    tips.push('🏃 Kết hợp tập luyện cardio và tập tạ để giữ cơ bắp trong khi giảm mỡ');
    tips.push('🥗 Ưu tiên protein để bảo vệ cơ bắp và tăng cảm giác no');
    tips.push('😴 Ngủ đủ 7-8 tiếng mỗi đêm để hỗ trợ giảm cân hiệu quả');
  } else if (goalType === 'weight_gain') {
    tips.push('🍗 Ăn nhiều protein chất lượng cao để xây dựng cơ bắp');
    tips.push('🏋️ Tập luyện sức mạnh 3-4 lần/tuần để tăng cơ thay vì tăng mỡ');
    tips.push('🍽️ Chia nhỏ bữa ăn thành 5-6 bữa/ngày để dễ tiêu hóa');
    tips.push('💤 Nghỉ ngơi đầy đủ giữa các buổi tập để cơ bắp phục hồi và phát triển');
  } else {
    tips.push('⚖️ Duy trì cân nặng ổn định bằng cách ăn uống cân đối');
    tips.push('🏃 Tập luyện đều đặn 3-5 lần/tuần để giữ sức khỏe');
    tips.push('🥗 Ăn đa dạng các nhóm thực phẩm để cung cấp đủ dinh dưỡng');
  }
  
  return tips;
};

/**
 * Calculate suggested macro distribution
 */
export const calculateMacroDistribution = (targetCalories, goalType) => {
  let proteinPercent, carbsPercent, fatPercent;
  
  if (goalType === 'weight_loss') {
    // High protein for muscle preservation during deficit
    proteinPercent = 0.35;
    carbsPercent = 0.35;
    fatPercent = 0.30;
  } else if (goalType === 'weight_gain') {
    // Balanced with emphasis on carbs for energy
    proteinPercent = 0.30;
    carbsPercent = 0.45;
    fatPercent = 0.25;
  } else {
    // Balanced maintenance
    proteinPercent = 0.30;
    carbsPercent = 0.40;
    fatPercent = 0.30;
  }
  
  return {
    protein: Math.round((targetCalories * proteinPercent) / 4), // 4 cal per gram
    carbs: Math.round((targetCalories * carbsPercent) / 4), // 4 cal per gram
    fat: Math.round((targetCalories * fatPercent) / 9) // 9 cal per gram
  };
};

export default {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  validateWeightGoal,
  generateHealthTips,
  calculateMacroDistribution,
  CALORIES_PER_KG,
  MAX_SAFE_WEIGHT_LOSS_PER_WEEK,
  MAX_SAFE_WEIGHT_GAIN_PER_WEEK
};





