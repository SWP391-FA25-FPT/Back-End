import Goal from '../models/Goal.js';
import User from '../models/User.model.js';
import {
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  validateWeightGoal,
  generateHealthTips
} from '../utils/goalValidation.js';

// @desc    Create a new goal
// @route   POST /api/goals
// @access  Private
export const createGoal = async (req, res) => {
  try {
    const { targetWeight, duration, durationType, description } = req.body;
    
    // Get user profile
    const user = await User.findById(req.user._id);
    if (!user || !user.profile) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng hoàn thiện hồ sơ trước khi tạo mục tiêu'
      });
    }
    
    const { weight, height, age, gender, workHabits } = user.profile;
    
    // Validate required profile fields
    if (!weight || !height || !age || !gender || !workHabits) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin hồ sơ: cân nặng, chiều cao, tuổi, giới tính, hoặc mức độ hoạt động'
      });
    }
    
    // Validate input
    if (!targetWeight || !duration) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp cân nặng mục tiêu và thời gian'
      });
    }
    
    // Convert duration to weeks
    let durationWeeks = duration;
    if (durationType === 'months') {
      durationWeeks = duration * 4; // Approximate 4 weeks per month
    }
    
    // Validate goal
    const validation = validateWeightGoal(weight, targetWeight, durationWeeks, gender);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Mục tiêu không hợp lệ',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    // Check if user already has an active goal
    const existingGoal = await Goal.findOne({ userId: req.user._id, status: 'active' });
    if (existingGoal) {
      return res.status(400).json({
        success: false,
        error: 'Bạn đã có một mục tiêu đang hoạt động. Vui lòng hoàn thành hoặc hủy mục tiêu hiện tại trước khi tạo mục tiêu mới.'
      });
    }
    
    // Calculate BMR and TDEE
    const bmr = calculateBMR(weight, height, age, gender);
    const tdee = calculateTDEE(bmr, workHabits);
    
    // Calculate target calories
    const targetCaloriesPerDay = calculateCalorieTarget(tdee, validation.weeklyWeightChange, gender);
    
    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (durationWeeks * 7));
    
    // Generate health tips
    const tips = generateHealthTips(validation.goalType, validation.weeklyWeightChange);
    
    // Create goal
    const goal = await Goal.create({
      userId: req.user._id,
      goalType: validation.goalType,
      startWeight: weight,
      targetWeight,
      currentWeight: weight,
      startDate,
      endDate,
      duration: durationWeeks,
      targetCaloriesPerDay,
      weeklyWeightChange: validation.weeklyWeightChange,
      description: description || '',
      warnings: validation.warnings,
      actualProgress: [{
        date: startDate,
        weight,
        note: 'Cân nặng ban đầu'
      }]
    });
    
    res.status(201).json({
      success: true,
      data: goal,
      tips,
      tdee,
      bmr
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo mục tiêu',
      details: error.message
    });
  }
};

// @desc    Get all user goals
// @route   GET /api/goals
// @access  Private
export const getGoals = async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) {
      query.status = status;
    }
    
    const goals = await Goal.find(query).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: goals.length,
      data: goals
    });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy danh sách mục tiêu',
      details: error.message
    });
  }
};

// @desc    Get active goal
// @route   GET /api/goals/active
// @access  Private
export const getActiveGoal = async (req, res) => {
  try {
    const goal = await Goal.findOne({ 
      userId: req.user._id, 
      status: 'active' 
    });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy mục tiêu đang hoạt động'
      });
    }
    
    res.status(200).json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('Get active goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy mục tiêu hiện tại',
      details: error.message
    });
  }
};

// @desc    Get goal by ID
// @route   GET /api/goals/:id
// @access  Private
export const getGoalById = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy mục tiêu'
      });
    }
    
    // Check ownership
    if (goal.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền truy cập mục tiêu này'
      });
    }
    
    res.status(200).json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('Get goal by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy thông tin mục tiêu',
      details: error.message
    });
  }
};

// @desc    Update goal
// @route   PUT /api/goals/:id
// @access  Private
export const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy mục tiêu'
      });
    }
    
    // Check ownership
    if (goal.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền chỉnh sửa mục tiêu này'
      });
    }
    
    const { currentWeight, status, description, note } = req.body;
    
    // Update current weight if provided
    if (currentWeight !== undefined) {
      await goal.updateWeight(currentWeight, new Date(), note || '');
    }
    
    // Update status if provided
    if (status && ['active', 'completed', 'cancelled', 'paused'].includes(status)) {
      goal.status = status;
    }
    
    // Update description if provided
    if (description !== undefined) {
      goal.description = description;
    }
    
    await goal.save();
    
    res.status(200).json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật mục tiêu',
      details: error.message
    });
  }
};

// @desc    Complete goal
// @route   PUT /api/goals/:id/complete
// @access  Private
export const completeGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy mục tiêu'
      });
    }
    
    // Check ownership
    if (goal.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền chỉnh sửa mục tiêu này'
      });
    }
    
    goal.status = 'completed';
    await goal.save();
    
    res.status(200).json({
      success: true,
      message: 'Chúc mừng! Bạn đã hoàn thành mục tiêu',
      data: goal
    });
  } catch (error) {
    console.error('Complete goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể hoàn thành mục tiêu',
      details: error.message
    });
  }
};

// @desc    Cancel goal
// @route   DELETE /api/goals/:id
// @access  Private
export const cancelGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy mục tiêu'
      });
    }
    
    // Check ownership
    if (goal.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền xóa mục tiêu này'
      });
    }
    
    goal.status = 'cancelled';
    await goal.save();
    
    res.status(200).json({
      success: true,
      message: 'Đã hủy mục tiêu',
      data: goal
    });
  } catch (error) {
    console.error('Cancel goal error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể hủy mục tiêu',
      details: error.message
    });
  }
};





