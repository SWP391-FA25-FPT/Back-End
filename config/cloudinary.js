import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Meta-Meal",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1000, height: 1000, crop: "limit" }]
  }
});

// Cấu hình upload với giới hạn
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const isValid = allowedTypes.test(file.originalname.toLowerCase()) && 
                    allowedTypes.test(file.mimetype);
    
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ cho phép upload file ảnh (JPEG, JPG, PNG, GIF, WEBP)"));
    }
  }
});

// Function kiểm tra status
export const checkCloudinaryStatus = async () => {
  try {
    await cloudinary.api.ping();
    const resources = await cloudinary.api.resources({ 
      type: 'upload', 
      prefix: 'Meta-Meal',
      max_results: 1 
    });
    return {
      status: 'connected',
      folder: 'Meta-Meal',
      resources: resources.resources.length,
      rate_limit_remaining: resources.rate_limit_remaining || 'N/A'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
};

export { cloudinary, upload };
