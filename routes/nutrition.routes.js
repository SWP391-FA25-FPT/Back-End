import express from "express";
import { calculateNutrition } from "../controllers/nutrition.controller.js";
// Có thể thêm middleware protect nếu cần authentication
// import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Route tính toán dinh dưỡng
router.post("/calc", calculateNutrition);

export default router;

