import Challenge from "../models/Challenge.js";
import Recipe from "../models/Recipe.js";
import User from "../models/User.model.js";
import { cloudinary } from "../config/cloudinary.js";

// @desc    Create new challenge
// @route   POST /api/challenges
// @access  Private (Admin only)
export const createChallenge = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      startDate,
      endDate,
      hostName,
      hostAvatar,
      prizes,
      prizeDetails,
      hashtags,
      requirements,
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp đầy đủ thông tin: tiêu đề, mô tả, danh mục, ngày bắt đầu và ngày kết thúc",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: "Ngày kết thúc phải sau ngày bắt đầu",
      });
    }

    // Get image from uploaded files
    let imageUrl = "";
    if (req.file) {
      imageUrl = req.file.path || req.file.url || "";
    }

    // Parse JSON fields if they are strings
    let parsedPrizes = [];
    if (prizes) {
      try {
        parsedPrizes = typeof prizes === "string" ? JSON.parse(prizes) : prizes;
        if (!Array.isArray(parsedPrizes)) {
          parsedPrizes = [];
        }
      } catch (e) {
        console.error("Error parsing prizes:", e);
        parsedPrizes = [];
      }
    }

    let parsedPrizeDetails = {};
    if (prizeDetails) {
      try {
        parsedPrizeDetails =
          typeof prizeDetails === "string"
            ? JSON.parse(prizeDetails)
            : prizeDetails;
      } catch (e) {
        console.error("Error parsing prizeDetails:", e);
        parsedPrizeDetails = {};
      }
    }

    let parsedHashtags = [];
    if (hashtags) {
      try {
        parsedHashtags =
          typeof hashtags === "string" ? JSON.parse(hashtags) : hashtags;
        if (!Array.isArray(parsedHashtags)) {
          parsedHashtags = [];
        }
      } catch (e) {
        console.error("Error parsing hashtags:", e);
        parsedHashtags = [];
      }
    }

    let parsedRequirements = [];
    if (requirements) {
      try {
        parsedRequirements =
          typeof requirements === "string"
            ? JSON.parse(requirements)
            : requirements;
        if (!Array.isArray(parsedRequirements)) {
          parsedRequirements = [];
        }
      } catch (e) {
        console.error("Error parsing requirements:", e);
        parsedRequirements = [];
      }
    }

    // Create challenge
    const challengeData = {
      title,
      description,
      image: imageUrl || "",
      category,
      startDate: start,
      endDate: end,
      host: {
        userId: req.user._id,
        name: hostName || req.user.name || "Admin",
        avatar: hostAvatar || req.user.avatar || "",
      },
      prizes: parsedPrizes || [],
      prizeDetails: parsedPrizeDetails || {},
      hashtags: parsedHashtags || [],
      requirements: parsedRequirements || [],
      participants: [],
      entries: [],
    };

    const challenge = await Challenge.create(challengeData);

    res.status(201).json({
      success: true,
      message: "Tạo thử thách thành công",
      data: challenge,
    });
  } catch (error) {
    console.error("Create challenge error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tạo thử thách",
    });
  }
};

// @desc    Get all challenges with filters
// @route   GET /api/challenges
// @access  Public
export const getAllChallenges = async (req, res) => {
  try {
    const { search, status, category, page = 1, limit = 20 } = req.query;

    // Build query
    const query = {};

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    }

    // Filter by category
    if (category && category !== "all") {
      query.category = category;
    }

    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const challenges = await Challenge.find(query)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("host.userId", "name email avatar")
      .populate("participants", "name avatar")
      .populate("entries.userId", "name avatar")
      .populate("entries.recipeId");

    // Get total count for pagination
    const total = await Challenge.countDocuments(query);

    // Calculate stats
    const stats = {
      ongoingChallenges: await Challenge.countDocuments({ status: "ongoing" }),
      totalParticipants: await Challenge.aggregate([
        { $project: { count: { $size: "$participants" } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).then((result) => (result[0]?.total || 0)),
      totalEntries: await Challenge.aggregate([
        { $project: { count: { $size: "$entries" } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).then((result) => (result[0]?.total || 0)),
      prizesAwarded: 0, // Can be calculated based on ended challenges
    };

    res.status(200).json({
      success: true,
      data: challenges,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Get all challenges error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách thử thách",
    });
  }
};

// @desc    Get challenge by ID
// @route   GET /api/challenges/:id
// @access  Public
export const getChallengeById = async (req, res) => {
  try {
    const { id } = req.params;

    const challenge = await Challenge.findById(id)
      .populate("host.userId", "name email avatar")
      .populate("participants", "name avatar")
      .populate("entries.userId", "name avatar")
      .populate("entries.recipeId");

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    // Calculate time left
    const timeLeft = challenge.getTimeLeft();

    res.status(200).json({
      success: true,
      data: {
        ...challenge.toObject(),
        timeLeft,
        participantsCount: challenge.participantsCount,
        entriesCount: challenge.entriesCount,
      },
    });
  } catch (error) {
    console.error("Get challenge by ID error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy thử thách",
    });
  }
};

// @desc    Update challenge
// @route   PUT /api/challenges/:id
// @access  Private (Admin only)
export const updateChallenge = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    const {
      title,
      description,
      category,
      startDate,
      endDate,
      hostName,
      hostAvatar,
      prizes,
      prizeDetails,
      hashtags,
      requirements,
      status,
    } = req.body;

    // Update fields if provided
    if (title) challenge.title = title;
    if (description) challenge.description = description;
    if (category) challenge.category = category;
    if (startDate) challenge.startDate = new Date(startDate);
    if (endDate) challenge.endDate = new Date(endDate);
    if (hostName) challenge.host.name = hostName;
    if (hostAvatar) challenge.host.avatar = hostAvatar;
    if (status) challenge.status = status;

    // Handle JSON fields
    if (prizes) {
      challenge.prizes =
        typeof prizes === "string" ? JSON.parse(prizes) : prizes;
    }
    if (prizeDetails) {
      challenge.prizeDetails =
        typeof prizeDetails === "string"
          ? JSON.parse(prizeDetails)
          : prizeDetails;
    }
    if (hashtags) {
      challenge.hashtags =
        typeof hashtags === "string" ? JSON.parse(hashtags) : hashtags;
    }
    if (requirements) {
      challenge.requirements =
        typeof requirements === "string"
          ? JSON.parse(requirements)
          : requirements;
    }

    // Update image if uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (challenge.image && challenge.image.includes("cloudinary.com")) {
        try {
          const urlParts = challenge.image.split("/");
          const filename = urlParts[urlParts.length - 1];
          const publicId = `Meta-Meal/challenges/${filename.split(".")[0]}`;
          await cloudinary.uploader.destroy(publicId);
          console.log("Deleted old challenge image:", publicId);
        } catch (err) {
          console.error("Error deleting old challenge image:", err.message);
        }
      }

      challenge.image = req.file.path;
    }

    await challenge.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật thử thách thành công",
      data: challenge,
    });
  } catch (error) {
    console.error("Update challenge error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi cập nhật thử thách",
    });
  }
};

// @desc    Delete challenge
// @route   DELETE /api/challenges/:id
// @access  Private (Admin only)
export const deleteChallenge = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    // Delete image from Cloudinary if it exists
    if (challenge.image && challenge.image.includes("cloudinary.com")) {
      try {
        const urlParts = challenge.image.split("/");
        const filename = urlParts[urlParts.length - 1];
        const publicId = `Meta-Meal/challenges/${filename.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
        console.log("Deleted challenge image:", publicId);
      } catch (err) {
        console.error("Error deleting challenge image:", err.message);
      }
    }

    await challenge.deleteOne();

    res.status(200).json({
      success: true,
      message: "Xóa thử thách thành công",
      data: {},
    });
  } catch (error) {
    console.error("Delete challenge error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi xóa thử thách",
    });
  }
};

// @desc    Join challenge
// @route   POST /api/challenges/:id/join
// @access  Private
export const joinChallenge = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    // Check if challenge is ongoing or upcoming
    if (challenge.status === "ended") {
      return res.status(400).json({
        success: false,
        error: "Thử thách đã kết thúc",
      });
    }

    const userId = req.user._id.toString();

    // Check if user already joined
    if (challenge.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: "Bạn đã tham gia thử thách này",
      });
    }

    // Add user to participants
    challenge.participants.push(userId);
    await challenge.save();

    res.status(200).json({
      success: true,
      message: "Tham gia thử thách thành công",
      data: challenge,
    });
  } catch (error) {
    console.error("Join challenge error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tham gia thử thách",
    });
  }
};

// @desc    Submit entry to challenge
// @route   POST /api/challenges/:id/entries
// @access  Private
export const submitEntry = async (req, res) => {
  try {
    const { recipeId, title, image } = req.body;

    if (!recipeId) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng cung cấp ID công thức",
      });
    }

    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    // Check if challenge is ongoing
    if (challenge.status !== "ongoing") {
      return res.status(400).json({
        success: false,
        error: "Thử thách chưa bắt đầu hoặc đã kết thúc",
      });
    }

    // Check if user joined the challenge
    const userId = req.user._id.toString();
    if (!challenge.participants.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: "Bạn cần tham gia thử thách trước khi nộp bài",
      });
    }

    // Check if recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy công thức",
      });
    }

    // Check if user already submitted this recipe
    const existingEntry = challenge.entries.find(
      (entry) =>
        entry.recipeId.toString() === recipeId &&
        entry.userId.toString() === userId
    );

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        error: "Bạn đã nộp công thức này cho thử thách",
      });
    }

    // Get user subscription status
    const user = await User.findById(userId);
    const isPremium = user?.subscription?.status === "premium";

    // Create entry
    const entry = {
      recipeId,
      userId,
      author: req.user.name || req.user.email,
      authorAvatar: req.user.avatar || "",
      title: title || recipe.title,
      image: image || recipe.imageUrl || "",
      likes: [],
      rating: 0,
      views: 0,
      isPremium,
      submittedAt: new Date(),
    };

    challenge.entries.push(entry);
    await challenge.save();

    // Populate entry data
    await challenge.populate("entries.recipeId");
    await challenge.populate("entries.userId", "name avatar");

    const newEntry = challenge.entries[challenge.entries.length - 1];

    res.status(201).json({
      success: true,
      message: "Nộp bài thành công",
      data: newEntry,
    });
  } catch (error) {
    console.error("Submit entry error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách hoặc công thức",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi nộp bài",
    });
  }
};

// @desc    Get challenge statistics
// @route   GET /api/challenges/stats
// @access  Public
export const getChallengeStats = async (req, res) => {
  try {
    const stats = {
      ongoingChallenges: await Challenge.countDocuments({ status: "ongoing" }),
      upcomingChallenges: await Challenge.countDocuments({
        status: "upcoming",
      }),
      endedChallenges: await Challenge.countDocuments({ status: "ended" }),
      totalParticipants: await Challenge.aggregate([
        { $project: { count: { $size: "$participants" } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).then((result) => (result[0]?.total || 0)),
      totalEntries: await Challenge.aggregate([
        { $project: { count: { $size: "$entries" } } },
        { $group: { _id: null, total: { $sum: "$count" } } },
      ]).then((result) => (result[0]?.total || 0)),
      prizesAwarded: 0, // Can be calculated based on ended challenges with winners
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Get challenge stats error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy thống kê thử thách",
    });
  }
};

// @desc    Like an entry
// @route   POST /api/challenges/:id/entries/:entryId/like
// @access  Private
export const likeEntry = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách",
      });
    }

    const entry = challenge.entries.id(req.params.entryId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy bài nộp",
      });
    }

    const userId = req.user._id.toString();
    const likes = entry.likes || [];
    const isLiked = likes.some((id) => id.toString() === userId);

    if (isLiked) {
      // Remove like
      entry.likes = likes.filter((id) => id.toString() !== userId);
      await challenge.save();

      res.status(200).json({
        success: true,
        message: "Đã bỏ like",
        data: {
          isLiked: false,
          likesCount: entry.likes.length,
        },
      });
    } else {
      // Add like
      entry.likes.push(userId);
      await challenge.save();

      res.status(200).json({
        success: true,
        message: "Đã like",
        data: {
          isLiked: true,
          likesCount: entry.likes.length,
        },
      });
    }
  } catch (error) {
    console.error("Like entry error:", error);

    if (error.kind === "ObjectId") {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy thử thách hoặc bài nộp",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi like bài nộp",
    });
  }
};

