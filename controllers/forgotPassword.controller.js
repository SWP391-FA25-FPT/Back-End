import User from '../models/User.model.js';
import crypto from 'crypto';
import emailjs from '@emailjs/browser';

// @desc    Forgot password - Send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email address',
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save reset token to user (we'll add these fields to the model)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Send email using EmailJS
    await sendResetEmail(email, resetUrl, user.username);

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reset email',
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
};

// Helper function to send reset email using EmailJS
const sendResetEmail = async (email, resetUrl, username) => {
  try {
    // EmailJS configuration
    const serviceId = 'service_g92sko8';
    const templateId = 'template_gvtzwtr';
    const publicKey = process.env.EMAILJS_PUBLIC_KEY || 'your-emailjs-public-key';

    // Template parameters for EmailJS
    const templateParams = {
      to_email: email,
      to_name: username,
      reset_url: resetUrl,
      from_name: 'Meta Meal Team',
      message: `Hello ${username}, we received a request to reset your password for your Meta Meal account. Click the link below to reset your password. This link will expire in 10 minutes for security reasons.`,
    };

    // Send email using EmailJS
    await emailjs.send(serviceId, templateId, templateParams, publicKey);
    console.log('Reset email sent successfully via EmailJS');
  } catch (error) {
    console.error('Error sending reset email:', error);
    throw error;
  }
};
