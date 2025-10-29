import Blog from "../models/Blog.js";
import { cloudinary } from "../config/cloudinary.js";

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
    const { title, excerpt, content, category, tags, published } = req.body;

    // Validate required fields
    if (!title || !content) {
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
    if (req.files && req.files.image && req.files.image[0]) {
      imageUrl = req.files.image[0].path;
    }

    // Parse JSON fields if they are strings
    const parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;

    // Create blog with author from authenticated user
    const blog = await Blog.create({
      title,
      slug,
      excerpt: excerpt || "",
      content,
      author: req.user.name || req.user.email,
      authorAvatar: req.user.avatar || "",
      authorId: req.user._id,
      category: category || "",
      imageUrl: imageUrl || "",
      published: published || false,
      publishedAt: published ? new Date() : null,
      tags: parsedTags || [],
      likes: [],
      comments: [],
      views: 0,
    });

    res.status(201).json({
      success: true,
      message: "Tạo blog thành công",
      data: blog,
    });
  } catch (error) {
    console.error("Create blog error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tạo blog",
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

// @desc    Get single blog by ID or slug
// @route   GET /api/blogs/:id
// @access  Public (with restrictions based on published status)
export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by ID first, then by slug
    let blog = (await Blog.findById(id)) || (await Blog.findOne({ slug: id }));

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy blog",
      });
    }

    // Increment views
    blog.views = (blog.views || 0) + 1;
    await blog.save();

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

    res.status(200).json({
      success: true,
      data: blog,
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

    const { title, excerpt, content, category, tags, published } = req.body;

    // Update fields if provided
    if (title) blog.title = title;
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (content) blog.content = content;
    if (category !== undefined) blog.category = category;

    // Handle JSON fields
    if (tags) {
      blog.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
    }

    // Update published status
    if (published !== undefined) {
      blog.published = published;
      if (published && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
    }

    // Update image if uploaded
    if (req.files && req.files.image && req.files.image[0]) {
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

      blog.imageUrl = req.files.image[0].path;
    }

    await blog.save();

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
