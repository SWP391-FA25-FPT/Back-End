import User from '../models/User.model.js';
import Recipe from '../models/Recipe.js';
import { sendNotification } from '../utils/notificationService.js';

const ensureProfileObject = (profile) =>
  profile && typeof profile === 'object' ? profile : {};

const mapUserSummary = (user) => ({
  _id: user._id,
  name: user.name || user.email,
  username: user.username || '',
  email: user.email,
  avatar: user.profile?.profileImageUrl || null,
});

const formatProfileUser = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  role: user.role,
  isFirstLogin: user.isFirstLogin,
  subscription: user.subscription,
  profile: ensureProfileObject(user.profile),
});

const extractAuthorInfo = (authorDoc, fallbackName) => {
  if (!authorDoc) {
    return fallbackName
      ? {
          name: fallbackName,
        }
      : null;
  }

  const profile = ensureProfileObject(authorDoc.profile);

  return {
    _id: authorDoc._id,
    name: authorDoc.name || fallbackName || authorDoc.email,
    username: authorDoc.username || '',
    avatar: profile?.profileImageUrl || null,
  };
};

const formatRecipeCard = (recipe, explicitAuthorInfo = null) => {
  const populatedAuthor =
    typeof recipe.authorId === 'object' && recipe.authorId !== null
      ? extractAuthorInfo(recipe.authorId, recipe.author)
      : null;

  const authorInfo = explicitAuthorInfo || populatedAuthor || extractAuthorInfo(null, recipe.author);

  return {
    _id: recipe._id,
    name: recipe.name,
    image: recipe.image,
    description: recipe.description,
    totalTime: recipe.totalTime,
    servings: recipe.servings,
    tags: recipe.tags,
    trustScore: recipe.trustScore,
    author: authorInfo?.name || recipe.author,
    authorInfo,
    status: recipe.status,
    publishedAt: recipe.publishedAt,
  };
};

const buildProfilePayload = async (targetUserId, viewerId) => {
  const user = await User.findById(targetUserId).select('-password').lean();

  if (!user) {
    return null;
  }

  user.profile = ensureProfileObject(user.profile);

  const friendIds = Array.isArray(user.friends) ? user.friends : [];
  const followerIds = Array.isArray(user.followers) ? user.followers : [];
  const favoriteIds = Array.isArray(user.favorites) ? user.favorites : [];

  const isOwnProfile =
    viewerId && viewerId.toString() === user._id.toString();

  const [friendsDocs, followersDocs, publishedRecipes, savedRecipesDocs] = await Promise.all([
    friendIds.length
      ? User.find({ _id: { $in: friendIds } })
          .select('name username email profile.profileImageUrl')
          .lean()
      : [],
    followerIds.length
      ? User.find({ _id: { $in: followerIds } })
          .select('name username email profile.profileImageUrl')
          .lean()
      : [],
    Recipe.find({ authorId: user._id, status: 'published' })
      .sort({ publishedAt: -1, updatedAt: -1 })
      .lean(),
    isOwnProfile && favoriteIds.length
      ? Recipe.find({ _id: { $in: favoriteIds } })
          .populate('authorId', 'name username email profile.profileImageUrl')
          .sort({ updatedAt: -1 })
          .lean()
      : [],
  ]);

  const friendSummaries = friendsDocs.map(mapUserSummary);
  const followerSummaries = followersDocs.map(mapUserSummary);

  const ownerAuthorInfo = extractAuthorInfo(
    {
      ...user,
      profile: user.profile,
    },
    user.name || user.email
  );

  const publishedFormatted = publishedRecipes.map((recipe) =>
    formatRecipeCard(recipe, ownerAuthorInfo)
  );

  const savedFormatted = savedRecipesDocs.map((recipe) =>
    formatRecipeCard(recipe)
  );

  const stats = {
    friends: friendIds.length,
    followers: followerIds.length,
    recipes: publishedFormatted.length,
  };

  return {
    user: formatProfileUser(user),
    stats,
    friends: friendSummaries,
    followers: followerSummaries,
    recipes: publishedFormatted,
    savedRecipes: savedFormatted,
    isOwnProfile,
  };
};

// @desc    Get user profile
// @route   GET /api/user/profile or /api/user/profile/:id
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.user.id;
    const payload = await buildProfilePayload(targetUserId, req.user.id);

    if (!payload) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error('Get profile error:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get profile',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/profile or /api/user/profile/:id
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.user.id;

    if (req.params.id && req.params.id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Bạn không có quyền cập nhật hồ sơ này',
      });
    }

    const { name } = req.body;

    let profilePayload = {};

    if (req.body.profile) {
      if (typeof req.body.profile === 'string') {
        try {
          profilePayload = JSON.parse(req.body.profile);
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Dữ liệu profile không hợp lệ',
          });
        }
      } else {
        profilePayload = req.body.profile;
      }
    } else {
      const profileFields = [
        'weight',
        'height',
        'gender',
        'age',
        'workHabits',
        'eatingHabits',
        'diet',
        'allergies',
        'meals',
        'profileImageUrl',
      ];

      profileFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          profilePayload[field] = req.body[field];
        }
      });
    }

    const normalizeNumber = (value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const num = Number(value);
      return Number.isNaN(num) ? undefined : num;
    };

    const normalizeArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim() !== '') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {
          // ignore
        }
        return value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item);
      }
      return undefined;
    };

    const {
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
    } = profilePayload;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    user.profile = ensureProfileObject(user.profile);

    if (name) user.name = name;

    const normalizedWeight = normalizeNumber(weight);
    const normalizedHeight = normalizeNumber(height);
    const normalizedAge = normalizeNumber(age);
    const normalizedAllergies = normalizeArray(allergies);
    const normalizedMeals = normalizeArray(meals);

    if (normalizedWeight !== undefined) user.profile.weight = normalizedWeight;
    if (normalizedHeight !== undefined) user.profile.height = normalizedHeight;
    if (gender) user.profile.gender = gender;
    if (normalizedAge !== undefined) user.profile.age = normalizedAge;
    if (workHabits) user.profile.workHabits = workHabits;
    if (eatingHabits) user.profile.eatingHabits = eatingHabits;
    if (diet) user.profile.diet = diet;
    if (normalizedAllergies) user.profile.allergies = normalizedAllergies;
    if (normalizedMeals) user.profile.meals = normalizedMeals;

    if (req.file && req.file.path) {
      user.profile.profileImageUrl = req.file.path;
    } else if (profileImageUrl) {
      user.profile.profileImageUrl = profileImageUrl;
    }

    const wasFirstLogin = user.isFirstLogin;

    if (user.isFirstLogin) {
      user.isFirstLogin = false;
    }

    await user.save();

    if (wasFirstLogin) {
      await sendNotification({
        userId: user._id,
        type: 'system',
        title: 'Chào mừng bạn đến Meta Meal',
        message: 'Cảm ơn bạn đã hoàn thành khảo sát! Bắt đầu khám phá các công thức dành riêng cho bạn nhé.',
        actorId: req.user._id
      });
    }

    const payload = await buildProfilePayload(user._id, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: payload,
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

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

    const wasFirstLogin = user.isFirstLogin;

    user.isFirstLogin = false;
    await user.save();

    if (wasFirstLogin) {
      await sendNotification({
        userId: user._id,
        type: 'system',
        title: 'Chào mừng bạn đến Meta Meal',
        message: 'Cảm ơn bạn đã hoàn thành khảo sát! Bắt đầu khám phá các công thức dành riêng cho bạn nhé.',
        actorId: req.user._id
      });
    }

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

