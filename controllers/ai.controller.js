import { GoogleGenerativeAI } from "@google/generative-ai";

// API Key - Store in environment variable in production
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDz-GyCaNDsNtm7RWAHa-R1sQrAEuRpwbU";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(API_KEY);

// System prompt for nutrition AI
const SYSTEM_PROMPT = `Bạn là AI Tư Vấn M&M - một chuyên gia dinh dưỡng và ẩm thực thông minh.

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

/**
 * Chat with AI - Main endpoint
 */
export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // List of models to try - Using actual available models from API
    const modelsToTry = [
      "gemini-2.5-flash",           // Stable, fast, latest version
      "gemini-flash-latest",        // Always points to latest flash
      "gemini-2.5-pro",             // Higher quality
      "gemini-pro-latest",          // Always points to latest pro
      "gemini-2.0-flash",           // Fallback to 2.0
    ];

    let lastError = null;
    let aiResponse = null;

    // Try each model until one works
    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Trying model: ${modelName}`);

        // Get model
        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        // Build chat history
        const history = [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }],
          },
          {
            role: "model",
            parts: [
              {
                text: "Xin chào! Tôi là AI Tư Vấn M&M. Tôi có thể giúp bạn tư vấn về dinh dưỡng, thực đơn, và các mẹo nấu ăn. Bạn cần hỗ trợ gì hôm nay? 😊",
              },
            ],
          },
        ];

        // Add conversation history
        if (conversationHistory && conversationHistory.length > 0) {
          conversationHistory.forEach((msg) => {
            history.push({
              role: msg.type === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            });
          });
        }

        // Create chat
        const chat = model.startChat({
          history: history,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
          },
        });

        // Send message
        const result = await chat.sendMessage(message);
        const response = await result.response;
        aiResponse = response.text();

        console.log(`✅ Success with model: ${modelName}`);
        break; // Success, exit loop
      } catch (error) {
        console.error(`❌ Failed with model ${modelName}:`, error.message);
        lastError = error;
        continue; // Try next model
      }
    }

    // Check if we got a response
    if (aiResponse) {
      return res.status(200).json({
        success: true,
        data: {
          message: aiResponse,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // All models failed
    console.error("All models failed. Last error:", lastError);

    // Handle specific errors
    let errorMessage = "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau.";

    if (lastError?.message?.includes("API key") || lastError?.message?.includes("403")) {
      errorMessage = "API Key không hợp lệ hoặc đã hết hạn.";
    } else if (lastError?.message?.includes("quota") || lastError?.message?.includes("429")) {
      errorMessage = "Đã đạt giới hạn sử dụng API. Vui lòng thử lại sau.";
    } else if (lastError?.message?.includes("404") || lastError?.message?.includes("not found")) {
      errorMessage = "Model AI không khả dụng. Vui lòng liên hệ admin.";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? lastError?.message : undefined,
    });
  } catch (error) {
    console.error("Chat with AI error:", error);
    return res.status(500).json({
      success: false,
      error: "Lỗi server khi xử lý yêu cầu",
    });
  }
};

/**
 * Get available models (for debugging)
 */
export const getAvailableModels = async (req, res) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const models = data.models?.map((m) => ({
      name: m.name,
      displayName: m.displayName,
      supportedGenerationMethods: m.supportedGenerationMethods,
    }));

    return res.status(200).json({
      success: true,
      data: models,
    });
  } catch (error) {
    console.error("Get available models error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Health check for AI service
 */
export const healthCheck = async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Test");
    const response = await result.response;
    
    return res.status(200).json({
      success: true,
      message: "AI service is healthy",
      modelWorking: true,
      model: "gemini-2.5-flash",
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: "AI service is running but model may not be available",
      modelWorking: false,
      error: error.message,
    });
  }
};

