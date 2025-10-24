const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Kiểm tra kết nối
// Kiểm tra kết nối và folder
cloudinary.api.ping()
  .then(() => {
    console.log('✅ Cloudinary connected');
    return cloudinary.api.resources({ 
      type: 'upload', 
      prefix: 'Meta-Meal',
      max_results: 5 
    });
  })
  .then(result => {
    console.log(`📁 Folder: Meta-Meal`);
    console.log(`📊 Total resources: ${result.resources.length}`);
    console.log(`💾 Rate limit remaining: ${result.rate_limit_remaining || 'N/A'}`);
  })
  .catch(err => {
    if (err.http_code === 404) {
      console.log('📁 Folder "Meta-Meal" chưa có resources (sẽ tự tạo khi upload)');
    } else {
      console.error('❌ Cloudinary error:', err.message);
    }
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

module.exports = { cloudinary, upload };
