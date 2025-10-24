import jwt from "jsonwebtoken";
import User from "../models/User.model.js";

// Generate JWT Token (Không thay đổi)
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || "default-secret", {
    expiresIn: "7d",
  });
};

// @desc    Register new user (Không thay đổi)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide username, email and password",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "User with this email or username already exists",
      });
    }

    const user = await User.create({
      username,
      email,
      password,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to register user",
    });
  }
};

// @desc    Login USER (user & professional)
// @route   POST /api/auth/login/user
// @access  Public
export const userLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide username and password",
      });
    }

    console.log(`[USER LOGIN] Đang tìm user: ${username}`);
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    }).select("+password");

    if (!user) {
      console.log(`[USER LOGIN] Lỗi: Không tìm thấy user.`);
      return res.status(401).json({
        success: false,
        error: "Username or Password is incorrect",
      });
    }

    // DEBUG: Kiểm tra xem mật khẩu có được lấy ra không
    console.log(
      `[USER LOGIN] Đã tìm thấy user: ${
        user.email
      }. Mật khẩu có tồn tại: ${!!user.password}`
    );

    const isPasswordMatch = await user.comparePassword(password);

    // DEBUG: Kiểm tra kết quả so sánh
    console.log(`[USER LOGIN] Kết quả so sánh mật khẩu: ${isPasswordMatch}`);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: "Username or Password is incorrect",
      });
    }

    const userRole = user.role.toLowerCase();
    if (userRole !== "user" && userRole !== "professional") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Not a user account.",
      });
    }

    const token = generateToken(user._id);
    console.log(`[USER LOGIN] Đăng nhập thành công cho: ${user.email}`);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to login",
    });
  }
};

// @desc    Login ADMIN
// @route   POST /api/auth/login/admin
// @access  Public
export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide username and password",
      });
    }

    console.log(`[ADMIN LOGIN] Đang tìm user: ${username}`);
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    }).select("+password");

    if (!user) {
      console.log(`[ADMIN LOGIN] Lỗi: Không tìm thấy user.`);
      return res.status(401).json({
        success: false,
        error: "Username or Password is incorrect",
      });
    }

    // DEBUG: Kiểm tra xem mật khẩu có được lấy ra không
    console.log(
      `[ADMIN LOGIN] Đã tìm thấy user: ${
        user.email
      }. Mật khẩu có tồn tại: ${!!user.password}`
    );

    const isPasswordMatch = await user.comparePassword(password);

    // DEBUG: Kiểm tra kết quả so sánh
    console.log(`[ADMIN LOGIN] Kết quả so sánh mật khẩu: ${isPasswordMatch}`);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: "Username or Password is incorrect",
      });
    }

    if (user.role.toLowerCase() !== "admin") {
      console.log(`[ADMIN LOGIN] Lỗi: User ${user.email} không phải admin.`);
      return res.status(403).json({
        success: false,
        error: "Access denied. Not an admin account.",
      });
    }

    const token = generateToken(user._id);
    console.log(`[ADMIN LOGIN] Đăng nhập thành công cho: ${user.email}`);
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: user.toJSON(),
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to login",
    });
  }
};

// @desc    Get current user (Không thay đổi)
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get user",
    });
  }
};
