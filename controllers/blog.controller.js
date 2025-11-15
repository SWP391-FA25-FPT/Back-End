import Blog from "../models/Blog.js";
import Recipe from "../models/Recipe.js";
import { cloudinary } from "../config/cloudinary.js";
import mongoose from "mongoose";
import { sendNotification } from "../utils/notificationService.js";

// Helper function to generate slug from title
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9 -]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .trim();
};

// @desc    Create new blog post
// @route   POST /api/blogs
// @access  Private (authenticated users)
export const createBlog = async (req, res) => {
  try {
    // Log incoming request data for debugging
    console.log("=== CREATE BLOG REQUEST ===");
    console.log("req.body:", req.body);
    console.log("req.file:", req.file ? { fieldname: req.file.fieldname, originalname: req.file.originalname, mimetype: req.file.mimetype } : null);
    console.log("req.user:", req.user ? { _id: req.user._id, email: req.user.email, name: req.user.name } : null);

    const {
      title,
      excerpt,
      content,
      category,
      tags,
      published,
      relatedRecipes,
    } = req.body;

    // Validate required fields
    if (!title || !content) {
      console.error("Missing required fields:", { title: !!title, content: !!content });
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp đầy đủ thông tin: tiêu đề và nội dung",
      });
    }

    // Generate slug from title
    const slug = generateSlug(title);

    // Check if slug already exists
    const existingBlog = await Blog.findOne({ slug });
    if (existingBlog) {
      return res.status(400).json({
        success: false,
        error: "Tiêu đề blog đã tồn tại",
      });
    }

    // Get image from uploaded files
    let imageUrl = "";
    if (req.file) {
      imageUrl = req.file.path || req.file.url || "";
    }

    // Parse JSON fields if they are strings
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
        if (!Array.isArray(parsedTags)) {
          parsedTags = [];
        }
      } catch (e) {
        console.error("Error parsing tags:", e);
        parsedTags = [];
      }
    }

    let parsedRelatedRecipes = [];
    if (relatedRecipes) {
      try {
        parsedRelatedRecipes =
          typeof relatedRecipes === "string"
            ? JSON.parse(relatedRecipes)
            : relatedRecipes;
        if (!Array.isArray(parsedRelatedRecipes)) {
          parsedRelatedRecipes = [];
        }
        // Validate ObjectIds if they exist
        if (parsedRelatedRecipes.length > 0) {
          parsedRelatedRecipes = parsedRelatedRecipes.filter(id => {
            if (typeof id === 'string') {
              return mongoose.Types.ObjectId.isValid(id);
            }
            return true;
          });
        }
      } catch (e) {
        console.error("Error parsing relatedRecipes:", e);
        parsedRelatedRecipes = [];
      }
    }

    // Blog mới tạo luôn phải chờ admin duyệt
    // User không thể tự publish blog, chỉ admin mới có thể duyệt
    const isPublished = false; // Luôn false khi user tạo, admin sẽ duyệt sau

    // Ensure authorId is properly formatted
    // authorId can be ObjectId or string, model accepts Mixed type
    const authorIdValue = req.user._id;

    // Create blog with author from authenticated user
    const blogData = {
      title,
      slug,
      excerpt: excerpt || "",
      content,
      author: req.user.name || req.user.email,
      authorAvatar: req.user.avatar || "",
      authorId: authorIdValue,
      category: category || "",
      imageUrl: imageUrl || "",
      published: isPublished, // Luôn false, cần admin duyệt
      publishedAt: null, // Chỉ set khi admin duyệt
      tags: parsedTags || [],
      relatedRecipes: parsedRelatedRecipes || [],
      likes: [],
      comments: [],
      views: 0,
    };

    console.log("Creating blog with data:", {
      title: blogData.title,
      slug: blogData.slug,
      author: blogData.author,
      category: blogData.category,
      published: blogData.published,
      tagsCount: blogData.tags?.length || 0,
      relatedRecipesCount: blogData.relatedRecipes?.length || 0,
      contentLength: blogData.content?.length || 0,
    });

    let blog;
    try {
      blog = await Blog.create(blogData);
    } catch (createError) {
      console.error("Blog creation error details:", {
        name: createError.name,
        message: createError.message,
        code: createError.code,
        keyPattern: createError.keyPattern,
        keyValue: createError.keyValue,
        errors: createError.errors,
      });
      
      // Handle specific MongoDB errors
      if (createError.code === 11000) {
        // Duplicate key error (slug already exists)
        return res.status(400).json({
          success: false,
          error: `Slug "${createError.keyValue?.slug || blogData.slug}" đã tồn tại. Vui lòng thử tiêu đề khác.`,
        });
      }
      
      if (createError.name === 'ValidationError') {
        const validationErrors = Object.values(createError.errors || {}).map(err => err.message).join(', ');
        return res.status(400).json({
          success: false,
          error: `Lỗi validation: ${validationErrors}`,
        });
      }
      
      // Re-throw to be caught by outer catch
      throw createError;
    }

    // Populate relatedRecipes after saving
    if (blog.relatedRecipes && blog.relatedRecipes.length > 0) {
      await Blog.populate(blog, { path: "relatedRecipes" });
    }

    res.status(201).json({
      success: true,
      message: "Tạo blog thành công",
      data: blog,
    });
  } catch (error) {
    console.error("=== CREATE BLOG ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error code:", error.code);
    console.error("Error keyPattern:", error.keyPattern);
    console.error("Error keyValue:", error.keyValue);
    console.error("Error errors:", error.errors);
    
    // If response was already sent, don't send again
    if (res.headersSent) {
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tạo blog",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Get all blogs with pagination, search, and filter
// @route   GET /api/blogs
// @access  Public
export const getAllBlogs = async (req, res) => {
  try {
    const {
      search,
      category,
      tags,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
    } = req.query;

    // Build query - only show published blogs to public
    const query = { published: true };

    // Search by title, excerpt, or content (case-insensitive)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      likes: { "likes.length": -1 },
      createdAt: { createdAt: -1 },
      updatedAt: { updatedAt: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.createdAt;

    // Execute query
    const blogs = await Blog.find(query).sort(sort).skip(skip).limit(limitNum);

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all blogs error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách blog",
    });
  }
};

// Helper function to sanitize date fields from MongoDB Extended JSON format
// Converts dates to ISO strings to avoid validation issues
const sanitizeBlogDates = (blog) => {
  if (!blog) return blog;

  try {
    // Fix top-level date fields - convert to ISO string
    const dateFields = ['createdAt', 'updatedAt', 'publishedAt', 'rejectedAt'];
    dateFields.forEach(field => {
      if (blog[field]) {
        if (typeof blog[field] === 'object' && blog[field].$date) {
          // MongoDB Extended JSON format
          blog[field] = new Date(blog[field].$date).toISOString();
        } else if (blog[field] instanceof Date) {
          // Already a Date object
          blog[field] = blog[field].toISOString();
        }
      }
    });

    // Fix comments dates recursively - convert to ISO strings
    if (blog.comments && Array.isArray(blog.comments)) {
      blog.comments = blog.comments.map(comment => {
        if (comment.createdAt) {
          if (typeof comment.createdAt === 'object' && comment.createdAt.$date) {
            comment.createdAt = new Date(comment.createdAt.$date).toISOString();
          } else if (comment.createdAt instanceof Date) {
            comment.createdAt = comment.createdAt.toISOString();
          }
        }
        // Fix replies dates recursively
        if (comment.replies && Array.isArray(comment.replies)) {
          comment.replies = comment.replies.map(reply => {
            if (reply.createdAt) {
              if (typeof reply.createdAt === 'object' && reply.createdAt.$date) {
                reply.createdAt = new Date(reply.createdAt.$date).toISOString();
              } else if (reply.createdAt instanceof Date) {
                reply.createdAt = reply.createdAt.toISOString();
              }
            }
            return reply;
          });
        }
        return comment;
      });
    }
  } catch (error) {
    console.error("Error sanitizing blog dates:", error);
    // Return blog as-is if sanitization fails
  }

  return blog;
};

// @desc    Get single blog by ID or slug
// @route   GET /api/blogs/:id
// @access  Public (with restrictions based on published status)
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by ID first, then by slug - use lean() to avoid validation
    let blog;
    try {
      blog = await Blog.findById(id).lean();
      if (!blog) {
        blog = await Blog.findOne({ slug: id }).lean();
      }
    } catch (findError) {
      console.error("Error finding blog:", findError);
      return res.status(500).json({
        success: false,
        error: "Lỗi khi tìm blog",
      });
    }

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    // Sanitize date fields before any operations - convert to ISO strings
    try {
      blog = sanitizeBlogDates(blog);
    } catch (sanitizeError) {
      console.error("Error sanitizing blog dates:", sanitizeError);
      // Continue even if sanitization fails
    }

    // Check access permissions based on blog status
    if (!blog.published) {
      const userId = req.user?._id;

      // Only allow access if user is the author or admin
      if (
        !userId ||
        (blog.authorId &&
          blog.authorId.toString() !== userId.toString() &&
          req.user.role !== "admin")
      ) {
        return res.status(403).json({
          success: false,
          error: "Blog này chưa được công khai",
        });
      }
    }

    // Increment views using raw MongoDB update to completely bypass Mongoose validation
    // This is the safest way to avoid any validation issues
    try {
      await Blog.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(blog._id) },
        { $inc: { views: 1 } }
      );
      // Update the local blog object for response
      blog.views = (blog.views || 0) + 1;
    } catch (updateError) {
      // If update fails, log but continue - don't block the response
      console.error("Error incrementing views:", updateError);
      // Still increment locally for response
      blog.views = (blog.views || 0) + 1;
    }

    // Manually populate relatedRecipes if needed (since we're using lean())
    if (blog.relatedRecipes && blog.relatedRecipes.length > 0) {
      const recipes = await Recipe.find({ 
        _id: { $in: blog.relatedRecipes } 
      }).lean();
      blog.relatedRecipes = recipes;
    }

    // Convert to plain object to ensure no Mongoose document methods remain
    // This prevents any validation from being triggered during JSON serialization
    // Use a custom replacer to handle any remaining issues
    let plainBlog;
    try {
      plainBlog = JSON.parse(JSON.stringify(blog, (key, value) => {
        // Convert any remaining Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Convert MongoDB Extended JSON format if still present
        if (value && typeof value === 'object' && value.$date) {
          return new Date(value.$date).toISOString();
        }
        return value;
      }));
    } catch (serializeError) {
      console.error("Error serializing blog:", serializeError);
      // Fallback: return blog as-is (should already be sanitized)
      plainBlog = blog;
    }

    res.status(200).json({
      success: true,
      data: plainBlog,
    });
  } catch (error) {
    console.error("Get blog by ID error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy blog",
    });
  }
};

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private (author or admin only)
export const updateBlog = async (req, res) => {
  try {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    const {
      title,
      excerpt,
      content,
      category,
      tags,
      published,
      relatedRecipes,
    } = req.body;

    // Update fields if provided
    if (title) blog.title = title;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (content) blog.content = content;
    if (category !== undefined) blog.category = category;

    // Handle JSON fields
    if (tags) {
      blog.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
    }
    if (relatedRecipes !== undefined) {
      blog.relatedRecipes =
        typeof relatedRecipes === "string"
          ? JSON.parse(relatedRecipes)
          : relatedRecipes;
    }

    // User không thể tự publish blog, chỉ admin mới có thể duyệt
    // Nếu user cố gắng set published, bỏ qua và giữ nguyên trạng thái hiện tại
    if (published !== undefined) {
      // Không cho phép user tự publish, chỉ admin mới có thể
      // Giữ nguyên trạng thái published hiện tại
      console.log("User attempted to change published status, ignoring. Current status:", blog.published);
    }

    // Update image if uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (blog.imageUrl && blog.imageUrl.includes("cloudinary.com")) {
        try {
          // Extract public_id from Cloudinary URL
          const urlParts = blog.imageUrl.split("/");
          const filename = urlParts[urlParts.length - 1];
          const publicId = `Meta-Meal/blogs/${filename.split(".")[0]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log("Deleted old blog image:", publicId);
        } catch (err) {
          console.error("Error deleting old blog image:", err.message);
        }
      }

      blog.imageUrl = req.file.path;
    }

    await blog.save();

    // Populate relatedRecipes after saving
    if (blog.relatedRecipes && blog.relatedRecipes.length > 0) {
      await Blog.populate(blog, { path: "relatedRecipes" });
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật blog thành công",
      data: blog,
    });
  } catch (error) {
    console.error("Update blog error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi cập nhật blog",
    });
  }
};

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private (author or admin only)
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    await blog.deleteOne();

    res.status(200).json({
      success: true,
      message: "Xóa blog thành công",
      data: {},
    });
  } catch (error) {
    console.error("Delete blog error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi xóa blog",
    });
  }
};

// @desc    Search blogs with advanced filters
// @route   GET /api/blogs/search
// @access  Public
export const searchBlogs = async (req, res) => {
  try {
    const {
      q,
      category,
      tags,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
    } = req.query;

    // Build search query - only published blogs
    const query = { published: true };

    // Search by keyword in title, excerpt, content
    if (q && q.trim() !== "") {
      const searchRegex = { $regex: q.trim(), $options: "i" };
      query.$or = [
        { title: searchRegex },
        { excerpt: searchRegex },
        { content: searchRegex },
        { tags: searchRegex },
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      likes: { "likes.length": -1 },
      createdAt: { createdAt: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.createdAt;

    // Execute query
    const blogs = await Blog.find(query).sort(sort).skip(skip).limit(limitNum);

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      searchQuery: q || "",
    });
  } catch (error) {
    console.error("Search blogs error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tìm kiếm blog",
    });
  }
};

// @desc    Add like to blog
// @route   POST /api/blogs/:id/like
// @access  Private
export const addLike = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    const userId = req.user._id.toString();
    const likes = blog.likes || [];
    const isLiked = likes.includes(userId);

    if (isLiked) {
      // Remove like
      blog.likes = likes.filter((id) => id.toString() !== userId);
      await blog.save();

      res.status(200).json({
        success: true,
        message: "Đã bỏ like blog",
        data: {
          isLiked: false,
          likesCount: blog.likes.length,
        },
      });
    } else {
      // Add like
      blog.likes.push(userId);
      await blog.save();

      res.status(200).json({
        success: true,
        message: "Đã like blog",
        data: {
          isLiked: true,
          likesCount: blog.likes.length,
        },
      });
    }
  } catch (error) {
    console.error("Add like error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi like blog",
    });
  }
};

// @desc    Add comment to blog
// @route   POST /api/blogs/:id/comment
// @access  Private
export const addComment = async (req, res) => {
  try {
    const { content, parentId } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập nội dung bình luận",
      });
    }

    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    const newComment = {
      userId: req.user._id.toString(),
      author: req.user.name || req.user.email,
      content,
      createdAt: new Date(),
      parentId: parentId || null,
      replies: [],
    };

    blog.comments.push(newComment);
    await blog.save();

    res.status(201).json({
      success: true,
      message: "Đã thêm bình luận",
      data: blog.comments[blog.comments.length - 1],
    });
  } catch (error) {
    console.error("Add comment error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi thêm bình luận",
    });
  }
};

// @desc    Get user's blogs
// @route   GET /api/blogs/my
// @access  Private
export const getMyBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, published } = req.query;

    // Build query
    const query = { authorId: req.user._id };
    if (published !== undefined) {
      query.published = published === "true";
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get my blogs error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách blog",
    });
  }
};

// @desc    Get top blogs by views (for hero section)
// @route   GET /api/blogs/top/views
// @access  Public
export const getTopBlogsByViews = async (req, res) => {
  try {
    const { limit = 3 } = req.query;

    // Get top blogs with highest views, only published blogs
    const limitNum = parseInt(limit);
    const blogs = await Blog.find({ published: true })
      .sort({ views: -1 })
      .limit(limitNum)
      .select(
        "title slug excerpt imageUrl author authorAvatar views publishedAt category tags createdAt updatedAt"
      );

    res.status(200).json({
      success: true,
      data: blogs,
      count: blogs.length,
    });
  } catch (error) {
    console.error("Get top blogs by views error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy top blog",
    });
  }
};

// @desc    Get all blogs (Admin only - includes unpublished)
// @route   GET /api/blogs/admin/all
// @access  Private (Admin only)
export const getAllBlogsAdmin = async (req, res) => {
  try {
    const {
      search,
      category,
      tags,
      published,
      rejected,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
    } = req.query;

    // Build query - admin can see all blogs
    const query = {};

    // Filter by rejected status if provided
    if (rejected !== undefined) {
      const rejectedValue = rejected === "true" || rejected === true;
      if (rejectedValue) {
        // Chỉ lấy blog bị từ chối
        query.rejected = true;
      } else if (rejected === "false" || rejected === false) {
        // Không lấy blog bị từ chối (bao gồm null và false)
        query.rejected = { $ne: true };
      }
    }

    // Filter by published status if provided
    if (published !== undefined) {
      const publishedValue = published === "true" || published === true;
      query.published = publishedValue;
      
      // Nếu filter published, loại trừ rejected blogs (trừ khi đang xem rejected)
      const isRejectedTab = rejected === "true" || rejected === true;
      if (publishedValue && !isRejectedTab) {
        query.rejected = { $ne: true };
      }
      // Nếu filter unpublished, loại trừ rejected blogs (trừ khi đang xem rejected)
      if (!publishedValue && !isRejectedTab) {
        query.rejected = { $ne: true };
      }
    }

    // Search by title, excerpt, or content (case-insensitive)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { excerpt: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort options
    const sortOptions = {
      views: { views: -1 },
      likes: { "likes.length": -1 },
      createdAt: { createdAt: -1 },
      updatedAt: { updatedAt: -1 },
    };
    const sort = sortOptions[sortBy] || sortOptions.createdAt;

    // Execute query
    const blogs = await Blog.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("authorId", "name email avatar");

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all blogs admin error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách blog",
    });
  }
};

// @desc    Delete blog (Admin only - can delete any blog)
// @route   DELETE /api/blogs/admin/:id
// @access  Private (Admin only)
export const deleteBlogAdmin = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    // Delete image from Cloudinary if it exists
    if (blog.imageUrl && blog.imageUrl.includes("cloudinary.com")) {
      try {
        const urlParts = blog.imageUrl.split("/");
        const filename = urlParts[urlParts.length - 1];
        const publicId = `Meta-Meal/blogs/${filename.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log("Deleted blog image:", publicId);
      } catch (err) {
        console.error("Error deleting blog image:", err.message);
      }
    }

    await blog.deleteOne();

    res.status(200).json({
      success: true,
      message: "Xóa blog thành công",
      data: {},
    });
  } catch (error) {
    console.error("Delete blog admin error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi xóa blog",
    });
  }
};

// @desc    Update blog (Admin only - can update any blog)
// @route   PUT /api/blogs/admin/:id
// @access  Private (Admin only)
export const updateBlogAdmin = async (req, res) => {
  try {
    let blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    const {
      title,
      excerpt,
      content,
      category,
      tags,
      published,
      relatedRecipes,
      rejected,
      rejectionReason,
    } = req.body;

    // Update fields if provided
    if (title) {
      blog.title = title;
      // Update slug if title changes
      blog.slug = generateSlug(title);
    }
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (content) blog.content = content;
    if (category !== undefined) blog.category = category;

    // Handle JSON fields
    if (tags) {
      blog.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
    }
    if (relatedRecipes !== undefined) {
      blog.relatedRecipes =
        typeof relatedRecipes === "string"
          ? JSON.parse(relatedRecipes)
          : relatedRecipes;
    }

    // Track changes for notifications
    const wasPublished = blog.published;
    const wasRejected = blog.rejected;
    let shouldNotifyApproved = false;
    let shouldNotifyRejected = false;

    // Update published status
    if (published !== undefined) {
      // Handle both boolean and string values (from JSON or FormData)
      const publishedValue = typeof published === 'string' 
        ? published === 'true' 
        : Boolean(published);
      
      // Chỉ gửi thông báo nếu chuyển từ chưa duyệt sang đã duyệt
      if (!wasPublished && publishedValue) {
        shouldNotifyApproved = true;
      }
      
      blog.published = publishedValue;
      if (publishedValue && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
      // Khi duyệt (published = true), reset rejected status
      if (publishedValue) {
        blog.rejected = false;
        blog.rejectionReason = "";
        blog.rejectedAt = null;
      }
    }

    // Update rejected status
    if (rejected !== undefined) {
      const rejectedValue = typeof rejected === 'string' 
        ? rejected === 'true' 
        : Boolean(rejected);
      
      // Chỉ gửi thông báo nếu chuyển từ chưa từ chối sang bị từ chối
      if (!wasRejected && rejectedValue) {
        shouldNotifyRejected = true;
      }
      
      blog.rejected = rejectedValue;
      if (rejectedValue) {
        blog.rejectedAt = new Date();
        blog.published = false; // Không thể publish nếu bị từ chối
        if (rejectionReason !== undefined) {
          blog.rejectionReason = rejectionReason || "";
        }
      } else {
        // Nếu không bị từ chối nữa, reset rejection info
        blog.rejectionReason = "";
        blog.rejectedAt = null;
      }
    }

    // Update image if uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (blog.imageUrl && blog.imageUrl.includes("cloudinary.com")) {
        try {
          const urlParts = blog.imageUrl.split("/");
          const filename = urlParts[urlParts.length - 1];
          const publicId = `Meta-Meal/blogs/${filename.split(".")[0]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log("Deleted old blog image:", publicId);
        } catch (err) {
          console.error("Error deleting old blog image:", err.message);
        }
      }

      blog.imageUrl = req.file.path;
    }

    await blog.save();

    // Populate relatedRecipes after saving
    if (blog.relatedRecipes && blog.relatedRecipes.length > 0) {
      await Blog.populate(blog, { path: "relatedRecipes" });
    }

    // Send notifications to blog author
    if (blog.authorId) {
      const authorId = typeof blog.authorId === 'object' && blog.authorId._id 
        ? blog.authorId._id 
        : blog.authorId;
      
      if (shouldNotifyApproved) {
        // Gửi thông báo blog đã được duyệt
        await sendNotification({
          userId: authorId,
          type: 'blog_approved',
          title: 'Blog đã được duyệt',
          message: `Blog "${blog.title}" của bạn đã được admin duyệt và đã được hiển thị công khai.`,
          actorId: req.user._id,
          blogId: blog._id,
          metadata: {
            blogTitle: blog.title,
            blogId: blog._id.toString()
          }
        });
      }
      
      if (shouldNotifyRejected) {
        // Gửi thông báo blog bị từ chối
        const rejectionMsg = blog.rejectionReason 
          ? `Blog "${blog.title}" của bạn đã bị từ chối với lý do: ${blog.rejectionReason}`
          : `Blog "${blog.title}" của bạn đã bị từ chối.`;
        
        await sendNotification({
          userId: authorId,
          type: 'blog_rejected',
          title: 'Blog bị từ chối',
          message: rejectionMsg,
          actorId: req.user._id,
          blogId: blog._id,
          metadata: {
            blogTitle: blog.title,
            blogId: blog._id.toString(),
            rejectionReason: blog.rejectionReason || ''
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Cập nhật blog thành công",
      data: blog,
    });
  } catch (error) {
    console.error("Update blog admin error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi cập nhật blog",
    });
  }
};

// @desc    Get blog statistics (Admin only)
// @route   GET /api/blogs/admin/stats
// @access  Private (Admin only)
export const getBlogStats = async (req, res) => {
  try {
    // Total blogs
    const totalBlogs = await Blog.countDocuments();

    // Published blogs (not rejected)
    const publishedBlogs = await Blog.countDocuments({ 
      published: true,
      rejected: { $ne: true }
    });

    // Unpublished blogs (not rejected)
    const unpublishedBlogs = await Blog.countDocuments({ 
      published: false,
      rejected: { $ne: true }
    });

    // Rejected blogs
    const rejectedBlogs = await Blog.countDocuments({ rejected: true });

    // Total views
    const totalViews = await Blog.aggregate([
      { $group: { _id: null, totalViews: { $sum: "$views" } } },
    ]);
    const views = totalViews.length > 0 ? totalViews[0].totalViews : 0;

    // Total likes
    const totalLikes = await Blog.aggregate([
      { $group: { _id: null, totalLikes: { $sum: { $size: "$likes" } } } },
    ]);
    const likes = totalLikes.length > 0 ? totalLikes[0].totalLikes : 0;

    // Total comments
    const totalComments = await Blog.aggregate([
      { $group: { _id: null, totalComments: { $sum: { $size: "$comments" } } } },
    ]);
    const comments = totalComments.length > 0 ? totalComments[0].totalComments : 0;

    // Blogs by category
    const blogsByCategory = await Blog.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Top blogs by views
    const topBlogsByViews = await Blog.find({ published: true })
      .sort({ views: -1 })
      .limit(5)
      .select("title views author category");

    // Blogs created in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBlogs = await Blog.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalBlogs,
        published: publishedBlogs,
        unpublished: unpublishedBlogs,
        rejected: rejectedBlogs,
        totalViews: views,
        totalLikes: likes,
        totalComments: comments,
        blogsByCategory,
        topBlogsByViews,
        recentBlogs,
      },
    });
  } catch (error) {
    console.error("Get blog stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy thống kê blog",
    });
  }
};