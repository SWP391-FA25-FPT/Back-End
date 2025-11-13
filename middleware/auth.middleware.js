import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import Recipe from "../models/Recipe.js";
import Blog from "../models/Blog.js";

// Protect routes - check if user is authenticated
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret"
      );

      // Get user from token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // Check if user is banned
      if (req.user.banned) {
        return res.status(403).json({
          success: false,
          error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin để biết thêm chi tiết.",
          banned: true,
          bannedReason: req.user.bannedReason || "Vi phạm quy tắc cộng đồng",
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: "Token is invalid or expired",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Admin only middleware
export const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: "Not authorized as an admin",
    });
  }
};

// Optional auth - attach user if token exists, but don't require it
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "default-secret"
        );

        // Get user from token
        req.user = await User.findById(decoded.id).select("-password");
      } catch (error) {
        // Token invalid but don't block request
        req.user = null;
      }
    }

    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};

// Check recipe ownership middleware (author or admin)
export const checkRecipeOwnership = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy công thức",
      });
    }

    // Check if user is author or admin (check if authorId exists)
    const isAuthor =
      recipe.authorId && recipe.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Attach recipe to request for later use
    req.recipe = recipe;
    next();
  } catch (error) {
    console.error("Check recipe ownership error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};

// Check blog ownership middleware (author or admin)
export const checkBlogOwnership = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    // Check if user is author or admin (check if authorId exists)
    const isAuthor =
      blog.authorId && blog.authorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Attach blog to request for later use
    req.blog = blog;
    next();
  } catch (error) {
    console.error("Check blog ownership error:", error);
    res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
};
