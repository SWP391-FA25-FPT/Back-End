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
import { upsertChatMessage, listRecentMessages, listUserConversations, getConversationMessages } from "../utils/qdrant.js";

export const chatWithAI = async (req, res) => {
  try {
    const { message, conversationHistory = [], conversationId: clientConversationId } = req.body;

    const userId = req.user?._id?.toString();
    const conversationId = clientConversationId || (userId ? `${userId}-${Date.now()}` : `guest-${Date.now()}`);

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    // List of models to try - Using actual available models from API
    const modelsToTry = MODELS_TO_TRY;
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
        } else if (userId && conversationId) {
          // If client didn't send history, try load recent messages from Qdrant
          try {
            const recent = await listRecentMessages({ conversationId, limit: 30 });
            recent.forEach((msg) => {
              history.push({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
              });
            });
          } catch (loadErr) {
            console.warn("Qdrant load history warning:", loadErr?.message || loadErr);
          }
        }

        // Create chat
        const chat = model.startChat({
          history: history,
          generationConfig: GENERATION_CONFIG,
          generationConfig: GENERATION_CONFIG,
        });

        // Send message
        const result = await chat.sendMessage(message);
        const response = await result.response;
        aiResponse = response.text();

        // Persist user & AI messages to Qdrant (best-effort)
        try {
          if (userId) {
            await upsertChatMessage({
              userId,
              conversationId,
              role: "user",
              content: message,
              timestamp: new Date().toISOString(),
            });
            await upsertChatMessage({
              userId,
              conversationId,
              role: "ai",
              content: aiResponse,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (persistErr) {
          console.warn("Qdrant persist warning:", persistErr?.response?.data || persistErr?.message || persistErr);
        }

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
          conversationId,
        },
      });
    }

    // All models failed
    console.error("All models failed. Last error:", lastError);

    // Handle specific errors
    let errorMessage = ERROR_MESSAGES.default;
    let errorMessage = ERROR_MESSAGES.default;

    if (lastError?.message?.includes("API key") || lastError?.message?.includes("403")) {
      errorMessage = ERROR_MESSAGES.apiKey;
      errorMessage = ERROR_MESSAGES.apiKey;
    } else if (lastError?.message?.includes("quota") || lastError?.message?.includes("429")) {
      errorMessage = ERROR_MESSAGES.quota;
      errorMessage = ERROR_MESSAGES.quota;
    } else if (lastError?.message?.includes("404") || lastError?.message?.includes("not found")) {
      errorMessage = ERROR_MESSAGES.modelNotFound;
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
 * List conversations for current user (Qdrant-backed)
 */
export const getMyConversations = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    const list = await listUserConversations({ userId, limit: 1000 });
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error("Get my conversations error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get messages for a conversation (Qdrant-backed)
 */
export const getConversationHistory = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const { conversationId } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    if (!conversationId) {
      return res.status(400).json({ success: false, error: "conversationId is required" });
    }
    const messages = await getConversationMessages({ userId, conversationId, limit: 2000 });
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error("Get conversation history error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

