import User from '../models/User.model.js';
import crypto from 'crypto';

// Generate secure reset token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// @desc    Forgot password - Send reset link
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng cung cấp địa chỉ email',
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi link đặt lại mật khẩu đến email của bạn.',
        data: {
          email: email,
          resetToken: null // Don't send token if user doesn't exist
        }
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = tokenExpires;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Link đặt lại mật khẩu đã được gửi đến email của bạn',
      data: {
        email: email,
        username: user.username || user.name,
        resetToken: resetToken // Frontend will use this to create reset link
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể gửi link đặt lại mật khẩu',
    });
  }
};

// @desc    Verify token and Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token và mật khẩu mới là bắt buộc',
      });
    }

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được đặt lại thành công',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể đặt lại mật khẩu',
    });
  }
};

