import {
  genAI,
  API_KEY,
  SYSTEM_PROMPT,
  INITIAL_AI_RESPONSE,
  MODELS_TO_TRY,
  GENERATION_CONFIG,
  DEFAULT_MODEL,
  ERROR_MESSAGES,
} from "../config/ai.config.js";

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
    const modelsToTry = MODELS_TO_TRY;

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
                text: INITIAL_AI_RESPONSE,
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
          generationConfig: GENERATION_CONFIG,
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
    let errorMessage = ERROR_MESSAGES.default;

    if (lastError?.message?.includes("API key") || lastError?.message?.includes("403")) {
      errorMessage = ERROR_MESSAGES.apiKey;
    } else if (lastError?.message?.includes("quota") || lastError?.message?.includes("429")) {
      errorMessage = ERROR_MESSAGES.quota;
    } else if (lastError?.message?.includes("404") || lastError?.message?.includes("not found")) {
      errorMessage = ERROR_MESSAGES.modelNotFound;
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
      error: ERROR_MESSAGES.serverError,
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
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const result = await model.generateContent("Test");
    const response = await result.response;
    
    return res.status(200).json({
      success: true,
      message: "AI service is healthy",
      modelWorking: true,
      model: DEFAULT_MODEL,
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
