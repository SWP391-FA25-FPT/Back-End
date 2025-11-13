import dotenv from "dotenv";

dotenv.config();

// Thông tin API Edamam
const APP_ID = process.env.EDAMAM_APP_ID ;
const APP_KEY = process.env.EDAMAM_APP_KEY;
const EDAMAM_URL = `https://api.edamam.com/api/nutrition-details?app_id=${APP_ID}&app_key=${APP_KEY}`;

// Kiểm tra trạng thái API
const checkEdamamStatus = () => {
  console.log("📊 Edamam API Configuration:");
  console.log(`   APP_ID: ${APP_ID ? "✅ Đã cấu hình" : "❌ Chưa cấu hình"}`);
  console.log(`   APP_KEY: ${APP_KEY ? "✅ Đã cấu hình" : "❌ Chưa cấu hình"}`);
};

export { APP_ID, APP_KEY, EDAMAM_URL, checkEdamamStatus };

