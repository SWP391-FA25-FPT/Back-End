import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key - Store in environment variable in production
export const API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
export const genAI = new GoogleGenerativeAI(API_KEY);

// Log connection status
if (API_KEY) {
  console.log(`✅ Gemini AI Connected`);
  console.log(`🤖 Model: gemini-2.5-flash (default)`);
} else {
  console.error(`❌ Gemini AI: API Key not found`);
}

// System prompt for nutrition AI
export const SYSTEM_PROMPT = `Bạn là AI Tư Vấn M&M - một chuyên gia dinh dưỡng và ẩm thực thông minh.

Vai trò của bạn:
- Tư vấn về dinh dưỡng, chế độ ăn uống lành mạnh
- Gợi ý công thức nấu ăn và thực đơn phù hợp
- Phân tích giá trị dinh dưỡng của món ăn
- Đưa ra lời khuyên về sức khỏe và lối sống
- Giải đáp thắc mắc về nấu ăn và nguyên liệu

Phong cách giao tiếp:
- Thân thiện, nhiệt tình và dễ hiểu
- Sử dụng tiếng Việt tự nhiên
- Đưa ra lời khuyên cụ thể, chi tiết
- Luôn quan tâm đến sức khỏe người dùng
- Có thể sử dụng emoji phù hợp để giao tiếp thân thiện hơn

Lưu ý:
- Nếu câu hỏi không liên quan đến dinh dưỡng, nấu ăn, hãy lịch sự chuyển hướng
- Luôn khuyến khích lối sống lành mạnh
- Không đưa ra lời khuyên y tế chuyên sâu, khuyên nên gặp bác sĩ nếu cần
- Cung cấp thông tin dựa trên khoa học và dinh dưỡng học

Bắt đầu trả lời:`;

// Initial AI greeting message
export const INITIAL_AI_RESPONSE = "Xin chào! Tôi là AI Tư Vấn M&M. Tôi có thể giúp bạn tư vấn về dinh dưỡng, thực đơn, và các mẹo nấu ăn. Bạn cần hỗ trợ gì hôm nay? 😊";

// List of models to try - Using actual available models from API
export const MODELS_TO_TRY = [
  "gemini-2.5-flash",           // Stable, fast, latest version
  "gemini-flash-latest",        // Always points to latest flash
  "gemini-2.5-pro",             // Higher quality
  "gemini-pro-latest",          // Always points to latest pro
  "gemini-2.0-flash",           // Fallback to 2.0
];

// Generation configuration
export const GENERATION_CONFIG = {
  maxOutputTokens: 1000,
  temperature: 0.7,
  topP: 0.8,
  topK: 40,
};

// Default model for health check
export const DEFAULT_MODEL = "gemini-2.5-flash";

// Error messages
export const ERROR_MESSAGES = {
  default: "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.",
  apiKey: "API Key không hợp lệ hoặc đã hết hạn.",
  quota: "Đã đạt giới hạn sử dụng API. Vui lòng thử lại sau.",
  modelNotFound: "Model AI không khả dụng. Vui lòng liên hệ admin.",
  serverError: "Lỗi server khi xử lý yêu cầu",
};
