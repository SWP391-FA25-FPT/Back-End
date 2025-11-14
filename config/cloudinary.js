import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const connectCloudinary = async () => {
  try {
    await cloudinary.api.ping();
    console.log("✅ Cloudinary is connected successfully");
  } catch (error) {
    console.error("Cloudinary connection error:", error);
    process.exit(1);
  }
};

// Cấu hình storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  },
});

// Cấu hình upload với giới hạn
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

// Cấu hình storage riêng cho recipes
const recipeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal/recipes",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

// Cấu hình upload cho recipes với nhiều ảnh
const uploadRecipe = multer({
  storage: recipeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

// Cấu hình storage riêng cho users
const userStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal/users",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 600, height: 600, crop: "limit" }],
  },
});

// Upload avatar user (single file)
const uploadUser = multer({
  storage: userStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

// Cấu hình storage riêng cho blogs
const blogStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal/blogs",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

// Cấu hình upload cho blogs
const uploadBlog = multer({
  storage: blogStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

// Cấu hình storage riêng cho challenges
const challengeStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal/challenges",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 800, crop: "limit" }],
  },
});

// Cấu hình upload cho challenges
const uploadChallenge = multer({
  storage: challengeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

// Cấu hình storage riêng cho challenge entries
const challengeEntryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal/challenge-entries",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

// Cấu hình upload cho challenge entries
const uploadChallengeEntry = multer({
  storage: challengeEntryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid =
      allowedTypes.test(file.originalname.toLowerCase()) &&
      allowedTypes.test(file.mimetype);

    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  },
});

export {
  cloudinary,
  upload,
  uploadRecipe,
  uploadBlog,
  uploadUser,
  uploadChallenge,
  uploadChallengeEntry,
  connectCloudinary,
};
