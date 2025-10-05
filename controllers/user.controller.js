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

