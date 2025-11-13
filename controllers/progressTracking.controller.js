import ProgressTracking from '../models/ProgressTracking.js';
import Goal from '../models/Goal.js';
import MealPlan from '../models/MealPlan.js';

// @desc    Add progress record
// @route   POST /api/progress
// @access  Private
export const addProgressRecord = async (req, res) => {
  try {
    const {
      date,
      actualWeight,
      actualCalories,
      actualMacros,
      waterIntake,
      exercised,
      exerciseDuration,
      exerciseType,
      notes,
      mood,
      goalId,
      mealPlanId
    } = req.body;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp ngày'
      });
    }
    
    // Normalize date to start of day for consistency
    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);
    
    // Check if record already exists for this date
    const existingRecord = await ProgressTracking.findOne({
      userId: req.user._id,
      date: recordDate
    });
    
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        error: 'Đã tồn tại bản ghi cho ngày này. Vui lòng cập nhật bản ghi hiện tại.'
      });
    }
    
    // Create progress record
    const progressRecord = await ProgressTracking.create({
      userId: req.user._id,
      goalId: goalId || null,
      mealPlanId: mealPlanId || null,
      date: recordDate,
      actualWeight: actualWeight || null,
      actualCalories: actualCalories || 0,
      actualMacros: actualMacros || {},
      waterIntake: waterIntake || 0,
      exercised: exercised || false,
      exerciseDuration: exerciseDuration || 0,
      exerciseType: exerciseType || '',
      notes: notes || '',
      mood: mood || ''
    });
    
    // If weight is provided and there's an active goal, update the goal
    if (actualWeight && goalId) {
      const goal = await Goal.findById(goalId);
      if (goal && goal.userId.toString() === req.user._id.toString() && goal.status === 'active') {
        await goal.updateWeight(actualWeight, recordDate, notes || '');
      }
    }
    
    res.status(201).json({
      success: true,
      data: progressRecord
    });
  } catch (error) {
    console.error('Add progress record error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Đã tồn tại bản ghi cho ngày này'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Không thể thêm bản ghi theo dõi',
      details: error.message
    });
  }
};

// @desc    Get progress records
// @route   GET /api/progress
// @access  Private
export const getProgressHistory = async (req, res) => {
  try {
    const { startDate, endDate, goalId, limit = 30 } = req.query;
    
    const query = { userId: req.user._id };
    
    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    // Filter by goal
    if (goalId) {
      query.goalId = goalId;
    }
    
    const records = await ProgressTracking.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .populate('goalId', 'goalType targetWeight targetCaloriesPerDay')
      .populate('mealPlanId', 'totalCalories totalMacros');
    
    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('Get progress history error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy lịch sử theo dõi',
      details: error.message
    });
  }
};

// @desc    Get progress statistics
// @route   GET /api/progress/stats
// @access  Private
export const getProgressStats = async (req, res) => {
  try {
    const { startDate, endDate, goalId } = req.query;
    
    const query = { userId: req.user._id };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    if (goalId) {
      query.goalId = goalId;
    }
    
    const records = await ProgressTracking.find(query).sort({ date: 1 });
    
    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalRecords: 0,
          averageCalories: 0,
          averageWater: 0,
          exerciseDays: 0,
          weightChange: 0,
          caloriesTrend: [],
          weightTrend: []
        }
      });
    }
    
    // Calculate statistics
    const totalRecords = records.length;
    const totalCalories = records.reduce((sum, r) => sum + (r.actualCalories || 0), 0);
    const totalWater = records.reduce((sum, r) => sum + (r.waterIntake || 0), 0);
    const exerciseDays = records.filter(r => r.exercised).length;
    
    const weightsWithValues = records.filter(r => r.actualWeight !== null && r.actualWeight !== undefined);
    const weightChange = weightsWithValues.length >= 2
      ? weightsWithValues[weightsWithValues.length - 1].actualWeight - weightsWithValues[0].actualWeight
      : 0;
    
    // Prepare trend data
    const caloriesTrend = records.map(r => ({
      date: r.date,
      value: r.actualCalories || 0
    }));
    
    const weightTrend = weightsWithValues.map(r => ({
      date: r.date,
      value: r.actualWeight
    }));
    
    res.status(200).json({
      success: true,
      data: {
        totalRecords,
        averageCalories: Math.round(totalCalories / totalRecords),
        averageWater: Math.round(totalWater / totalRecords),
        exerciseDays,
        exercisePercentage: Math.round((exerciseDays / totalRecords) * 100),
        weightChange: weightChange.toFixed(1),
        caloriesTrend,
        weightTrend
      }
    });
  } catch (error) {
    console.error('Get progress stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tính toán thống kê',
      details: error.message
    });
  }
};

// @desc    Update progress record
// @route   PUT /api/progress/:id
// @access  Private
export const updateProgressRecord = async (req, res) => {
  try {
    const progressRecord = await ProgressTracking.findById(req.params.id);
    
    if (!progressRecord) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy bản ghi'
      });
    }
    
    // Check ownership
    if (progressRecord.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền chỉnh sửa bản ghi này'
      });
    }
    
    const {
      actualWeight,
      actualCalories,
      actualMacros,
      waterIntake,
      exercised,
      exerciseDuration,
      exerciseType,
      notes,
      mood
    } = req.body;
    
    // Update fields
    if (actualWeight !== undefined) progressRecord.actualWeight = actualWeight;
    if (actualCalories !== undefined) progressRecord.actualCalories = actualCalories;
    if (actualMacros !== undefined) progressRecord.actualMacros = actualMacros;
    if (waterIntake !== undefined) progressRecord.waterIntake = waterIntake;
    if (exercised !== undefined) progressRecord.exercised = exercised;
    if (exerciseDuration !== undefined) progressRecord.exerciseDuration = exerciseDuration;
    if (exerciseType !== undefined) progressRecord.exerciseType = exerciseType;
    if (notes !== undefined) progressRecord.notes = notes;
    if (mood !== undefined) progressRecord.mood = mood;
    
    await progressRecord.save();
    
    // Update goal if weight changed
    if (actualWeight !== undefined && progressRecord.goalId) {
      const goal = await Goal.findById(progressRecord.goalId);
      if (goal && goal.userId.toString() === req.user._id.toString() && goal.status === 'active') {
        await goal.updateWeight(actualWeight, progressRecord.date, notes || '');
      }
    }
    
    res.status(200).json({
      success: true,
      data: progressRecord
    });
  } catch (error) {
    console.error('Update progress record error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật bản ghi',
      details: error.message
    });
  }
};

// @desc    Delete progress record
// @route   DELETE /api/progress/:id
// @access  Private
export const deleteProgressRecord = async (req, res) => {
  try {
    const progressRecord = await ProgressTracking.findById(req.params.id);
    
    if (!progressRecord) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy bản ghi'
      });
    }
    
    // Check ownership
    if (progressRecord.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Không có quyền xóa bản ghi này'
      });
    }
    
    await ProgressTracking.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Đã xóa bản ghi'
    });
  } catch (error) {
    console.error('Delete progress record error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể xóa bản ghi',
      details: error.message
    });
  }
};

// @desc    Get today's progress record
// @route   GET /api/progress/today
// @access  Private
export const getTodayProgress = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const record = await ProgressTracking.findOne({
      userId: req.user._id,
      date: { $gte: today, $lt: tomorrow }
    })
      .populate('goalId', 'goalType targetWeight targetCaloriesPerDay')
      .populate('mealPlanId', 'totalCalories totalMacros meals');
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Chưa có bản ghi cho hôm nay'
      });
    }
    
    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Get today progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể lấy bản ghi hôm nay',
      details: error.message
    });
  }
};





