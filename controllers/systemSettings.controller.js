import SystemSettings from '../models/SystemSettings.js';

// @desc    Get system settings (Admin only)
// @route   GET /api/admin/settings
// @access  Private (Admin only)
export const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    
    // If no settings exist, create default
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi lấy cài đặt hệ thống',
    });
  }
};

// @desc    Update system settings (Admin only)
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
export const updateSystemSettings = async (req, res) => {
  try {
    const {
      systemName,
      logoUrl,
      timezone,
      language,
      twoFactorAuth,
      lockThreshold,
      sessionTimeout,
      aiEnabled,
      aiCreativity,
      aiDailyLimit,
      notifyEmail,
      notifyFeedback,
      notifyPremium,
    } = req.body;

    // Get or create settings
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    // Update fields if provided
    if (systemName !== undefined) settings.systemName = systemName;
    if (logoUrl !== undefined) settings.logoUrl = logoUrl;
    if (timezone !== undefined) settings.timezone = timezone;
    if (language !== undefined) settings.language = language;
    if (twoFactorAuth !== undefined) settings.twoFactorAuth = twoFactorAuth;
    if (lockThreshold !== undefined) settings.lockThreshold = lockThreshold;
    if (sessionTimeout !== undefined) settings.sessionTimeout = sessionTimeout;
    if (aiEnabled !== undefined) settings.aiEnabled = aiEnabled;
    if (aiCreativity !== undefined) settings.aiCreativity = aiCreativity;
    if (aiDailyLimit !== undefined) settings.aiDailyLimit = aiDailyLimit;
    if (notifyEmail !== undefined) settings.notifyEmail = notifyEmail;
    if (notifyFeedback !== undefined) settings.notifyFeedback = notifyFeedback;
    if (notifyPremium !== undefined) settings.notifyPremium = notifyPremium;

    // Set last updated by
    settings.lastUpdatedBy = req.user._id;

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Đã cập nhật cài đặt hệ thống thành công',
      data: settings,
    });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Lỗi khi cập nhật cài đặt hệ thống',
    });
  }
};

