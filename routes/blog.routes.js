import express from "express";
import {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  searchBlogs,
  addLike,
  addComment,
  getMyBlogs,
} from "../controllers/blog.controller.js";
import {
  protect,
  optionalAuth,
  checkBlogOwnership,
} from "../middleware/auth.middleware.js";
import { uploadBlog } from "../config/cloudinary.js";

const router = express.Router();

// My blogs routes (must come before public routes to avoid conflicts)
router.get("/my", protect, getMyBlogs);

// Public routes
router.get("/search", searchBlogs);
router.get("/", getAllBlogs);
router.get("/:id", optionalAuth, getBlogById);

// Protected routes (require authentication)
router.post("/", protect, uploadBlog.single("image"), createBlog);

router.put(
  "/:id",
  protect,
  checkBlogOwnership,
  uploadBlog.single("image"),
  updateBlog
);

router.delete("/:id", protect, checkBlogOwnership, deleteBlog);

router.post("/:id/like", protect, addLike);
router.post("/:id/comment", protect, addComment);

export default router;
