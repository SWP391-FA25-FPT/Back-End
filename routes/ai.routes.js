import express from "express";
import { chatWithAI, getAvailableModels, getMyConversations, getConversationHistory } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Protected routes (require authentication)
router.post("/chat", protect, chatWithAI);

// Conversations APIs
router.get("/chat/conversations", protect, getMyConversations);
router.get("/chat/conversations/:conversationId", protect, getConversationHistory);

// Public routes (for debugging)
router.get("/models", getAvailableModels);

export default router;


