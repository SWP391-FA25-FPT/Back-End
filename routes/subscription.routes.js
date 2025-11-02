import express from "express";
import {
  createSubscription,
  confirmPayment,
  getMySubscription,
  cancelSubscription,
  getSubscriptionHistory,
  getTransactionHistory,
  getSubscriptionPlans,
  getAllSubscriptions,
  checkExpiredSubscriptions,
} from "../controllers/subscription.controller.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/plans", getSubscriptionPlans);

// Protected routes (require authentication)
router.post("/create", protect, createSubscription);
router.post("/confirm-payment", protect, confirmPayment);
router.get("/my-subscription", protect, getMySubscription);
router.get("/history", protect, getSubscriptionHistory);
router.get("/transactions", protect, getTransactionHistory);
router.put("/cancel/:subscriptionId", protect, cancelSubscription);

// Admin routes
router.get("/all", protect, admin, getAllSubscriptions);
router.post("/check-expired", protect, admin, checkExpiredSubscriptions);

export default router;


