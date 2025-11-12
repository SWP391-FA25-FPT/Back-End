import User from '../models/User.model.js';

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get profile',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const {
      name,
      profile: {
        weight,
        height,
        gender,
        age,
        workHabits,
        eatingHabits,
        diet,
        allergies,
        meals,
        profileImageUrl,
      } = {},
    } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Update basic info
    if (name) user.name = name;

    // Update profile fields
    if (weight !== undefined) user.profile.weight = weight;
    if (height !== undefined) user.profile.height = height;
    if (gender) user.profile.gender = gender;
    if (age !== undefined) user.profile.age = age;
    if (workHabits) user.profile.workHabits = workHabits;
    if (eatingHabits) user.profile.eatingHabits = eatingHabits;
    if (diet) user.profile.diet = diet;
    if (allergies) user.profile.allergies = allergies;
    if (meals) user.profile.meals = meals;
    if (profileImageUrl) user.profile.profileImageUrl = profileImageUrl;

    // Mark as not first login after profile update
    if (user.isFirstLogin) {
      user.isFirstLogin = false;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update profile',
    });
  }
};

// @desc    Complete onboarding (set isFirstLogin to false)
// @route   POST /api/user/complete-onboarding
// @access  Private
export const completeOnboarding = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    user.isFirstLogin = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Onboarding completed',
      data: user,
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete onboarding',
    });
  }
};

// ============ ADMIN FUNCTIONS ============

// @desc    Get all users (Admin only)
// @route   GET /api/user/admin/all
// @access  Private (Admin only)
export const getAllUsersAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, active } = req.query;

    const query = {};

    // Search by name, email, or username
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by role
    if (role) {
      query.role = role;
    }

    // Filter by banned status
    if (req.query.banned !== undefined) {
      query.banned = req.query.banned === 'true';
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all users admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy danh sách users',
    });
  }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/user/admin/:id
// @access  Private (Admin only)
export const getUserByIdAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user by ID admin error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy user',
    });
  }
};

// @desc    Update user (Admin only)
// @route   PUT /api/user/admin/:id
// @access  Private (Admin only)
export const updateUserAdmin = async (req, res) => {
  try {
    const { name, email, role, subscription } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }

    // Prevent changing your own role
    if (user._id.toString() === req.user._id.toString() && role && role !== user.role) {
      return res.status(400).json({
        success: false,
        error: 'Không thể thay đổi role của chính mình',
      });
    }

    // Prevent changing other admins' roles
    if (user.role === 'admin' && role && role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Không thể thay đổi role của admin khác',
      });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (subscription) {
      user.subscription = { ...user.subscription, ...subscription };
    }

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Cập nhật user thành công',
      data: userResponse,
    });
  } catch (error) {
    console.error('Update user admin error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email đã tồn tại',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật user',
    });
  }
};

// @desc    Ban user (Admin only)
// @route   PUT /api/user/admin/:id/ban
// @access  Private (Admin only)
export const banUserAdmin = async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }

    // Prevent banning yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Không thể ban chính mình',
      });
    }

    // Prevent banning other admins
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Không thể ban admin khác',
      });
    }

    user.banned = true;
    user.bannedAt = new Date();
    user.bannedReason = reason || 'Vi phạm quy tắc cộng đồng';
    user.bannedBy = req.user._id;
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Ban user thành công',
      data: userResponse,
    });
  } catch (error) {
    console.error('Ban user admin error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi ban user',
    });
  }
};

// @desc    Unban user (Admin only)
// @route   PUT /api/user/admin/:id/unban
// @access  Private (Admin only)
export const unbanUserAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }

    user.banned = false;
    user.bannedAt = undefined;
    user.bannedReason = undefined;
    user.bannedBy = undefined;
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Unban user thành công',
      data: userResponse,
    });
  } catch (error) {
    console.error('Unban user admin error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy user',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi unban user',
    });
  }
};

// @desc    Get user statistics (Admin only)
// @route   GET /api/user/admin/stats
// @access  Private (Admin only)
export const getUserStatsAdmin = async (req, res) => {
  try {
    // Total users
    const totalUsers = await User.countDocuments();

    // Users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Active users (users with subscription)
    const activeUsers = await User.countDocuments({
      'subscription.status': { $ne: 'free' },
    });

    // New users in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Users with completed profiles
    const usersWithProfiles = await User.countDocuments({
      'profile.weight': { $exists: true },
      'profile.height': { $exists: true },
    });

    // Banned users
    const bannedUsers = await User.countDocuments({ banned: true });

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        usersByRole,
        activeUsers,
        newUsers,
        usersWithProfiles,
        bannedUsers,
      },
    });
  } catch (error) {
    console.error('Get user stats admin error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy thống kê users',
    });
  }
};

