import express from "express";
import { chatWithAI, getAvailableModels } from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

// Protected routes (require authentication)
router.post("/chat", protect, chatWithAI);

// Public routes (for debugging)
router.get("/models", getAvailableModels);

export default router;


