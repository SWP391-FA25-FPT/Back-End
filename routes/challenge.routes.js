import express from "express";
import {
  createChallenge,
  getAllChallenges,
  getChallengeById,
  updateChallenge,
  deleteChallenge,
  joinChallenge,
  submitEntry,
  getChallengeStats,
  likeEntry,
} from "../controllers/challenge.controller.js";
import { protect, admin, optionalAuth } from "../middleware/auth.middleware.js";
import { uploadChallenge } from "../config/cloudinary.js";

const router = express.Router();

// Public routes
router.get("/stats", getChallengeStats);
router.get("/", getAllChallenges);
router.get("/:id", optionalAuth, getChallengeById);

// Protected routes (require authentication)
router.post("/:id/join", protect, joinChallenge);
router.post("/:id/entries", protect, submitEntry);
router.post("/:id/entries/:entryId/like", protect, likeEntry);

// Admin routes (require admin role)
router.post(
  "/",
  protect,
  admin,
  uploadChallenge.single("image"),
  createChallenge
);
router.put(
  "/:id",
  protect,
  admin,
  uploadChallenge.single("image"),
  updateChallenge
);
router.delete("/:id", protect, admin, deleteChallenge);

export default router;

