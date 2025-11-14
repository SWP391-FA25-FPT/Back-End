import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.model.js';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: '7d', // Token expires in 7 days
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register new user (Step 1: Create user with OTP)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide username, email and password' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email or username already exists' 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user (unverified)
    const user = await User.create({
      username,
      email,
      password, // Will be hashed by the pre-save hook
      emailVerified: false,
      verificationOTP: otp,
      verificationOTPExpires: otpExpires
    });

    res.status(201).json({
      success: true,
      message: 'User registered. Please verify your email with OTP.',
      data: {
        userId: user._id,
        email: user.email,
        username: user.username,
        otp: otp // In production, send via email instead
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to register user' 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide username and password' 
      });
    }

    // Find user (can login with username or email) - include password for comparison
    const user = await User.findOne({
      $or: [{ email: username }, { username: username }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để biết thêm chi tiết.',
        banned: true,
        bannedReason: user.bannedReason || 'Vi phạm quy tắc cộng đồng',
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({ 
        success: false,
        error: 'Username or Password is incorrect' 
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to login' 
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to get user' 
    });
  }
};

// @desc    Verify OTP (Step 2: Verify email with OTP)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validation
    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide email and OTP' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      // Generate token for already verified user
      const token = generateToken(user._id);
      return res.status(200).json({
        success: true,
        message: 'Email already verified',
        data: {
          user: user.toJSON(),
          token,
        },
      });
    }

    // Check if OTP is expired
    if (user.verificationOTPExpires < new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'OTP has expired. Please request a new one.' 
      });
    }

    // Verify OTP
    if (user.verificationOTP !== otp) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid OTP' 
      });
    }

    // Mark email as verified and clear OTP
    user.emailVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to verify OTP' 
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide email' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is already verified' 
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new OTP
    user.verificationOTP = otp;
    user.verificationOTPExpires = otpExpires;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'New OTP has been sent',
      data: {
        otp: otp // In production, send via email instead
      },
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to resend OTP' 
    });
  }
};

// @desc    Google OAuth Login
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;

    // Validation
    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide Google token' 
      });
    }

    let googleId, email, name, picture;

    // Try to verify as ID token first
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    try {
      // Try ID token verification
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    } catch (idTokenError) {
      // If ID token verification fails, try access_token
      try {
        // Get user info using access_token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user info from Google');
        }

        const userInfo = await userInfoResponse.json();
        googleId = userInfo.id;
        email = userInfo.email;
        name = userInfo.name;
        picture = userInfo.picture;
      } catch (accessTokenError) {
        console.error('Google token verification error:', accessTokenError);
        return res.status(401).json({ 
          success: false,
          error: 'Invalid Google token' 
        });
      }
    }

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email not provided by Google' 
      });
    }

    // Check if user exists by email
    let user = await User.findOne({ email });

    if (user) {
      // User exists - merge account (update with Google info)
      user.googleId = googleId;
      user.authProvider = 'google';
      user.emailVerified = true; // Google verifies email
      user.isFirstLogin = false; // User đã tồn tại, không cần survey nữa
      
      // Update name and profile image if not set
      if (!user.name && name) {
        user.name = name;
      }
      if (!user.profile?.profileImageUrl && picture) {
        if (!user.profile) user.profile = {};
        user.profile.profileImageUrl = picture;
      }
      
      await user.save();
    } else {
      // New user - create account
      // Generate username from email (before @) or use name
      const baseUsername = name?.toLowerCase().replace(/\s+/g, '') || email.split('@')[0];
      let username = baseUsername;
      let usernameExists = await User.findOne({ username });
      let counter = 1;
      
      // Ensure unique username
      while (usernameExists) {
        username = `${baseUsername}${counter}`;
        usernameExists = await User.findOne({ username });
        counter++;
      }

      user = await User.create({
        email,
        name: name || email.split('@')[0],
        username,
        googleId,
        authProvider: 'google',
        emailVerified: true, // Google verifies email
        isFirstLogin: true, // New user needs to complete survey
        profile: {
          profileImageUrl: picture || undefined,
        },
      });
    }

    // Check if user is banned
    if (user.banned) {
      return res.status(403).json({
        success: false,
        error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để biết thêm chi tiết.',
        banned: true,
        bannedReason: user.bannedReason || 'Vi phạm quy tắc cộng đồng',
      });
    }

    // Generate JWT token
    const jwtToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Google login successful',
      data: {
        user: user.toJSON(),
        token: jwtToken,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to login with Google' 
    });
  }
};


