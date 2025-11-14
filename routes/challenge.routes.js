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
  awardPrize,
} from "../controllers/challenge.controller.js";
import { protect, admin, optionalAuth } from "../middleware/auth.middleware.js";
import { uploadChallenge, uploadChallengeEntry } from "../config/cloudinary.js";

const router = express.Router();

// Public routes
router.get("/stats", getChallengeStats);
router.get("/", getAllChallenges);
router.get("/:id", optionalAuth, getChallengeById);

// Protected routes (require authentication)
router.post("/:id/join", protect, joinChallenge);
router.post("/:id/entries", protect, uploadChallengeEntry.single("image"), submitEntry);
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
router.put("/:id/award", protect, admin, awardPrize);
router.delete("/:id", protect, admin, deleteChallenge);

export default router;

