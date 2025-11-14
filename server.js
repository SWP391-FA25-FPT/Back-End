import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { connectCloudinary } from "./config/cloudinary.js";
import { checkEdamamStatus } from "./config/edamam.config.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import recipeRoutes from "./routes/recipe.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import userHistoryRoutes from "./routes/userHistory.routes.js";
import commentRoutes, { commentDeleteRouter } from "./routes/comment.routes.js";
import ratingRoutes, { ratingDeleteRouter } from "./routes/rating.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import mealplanRoutes from "./routes/mealplan.routes.js";
import goalRoutes from "./routes/goal.routes.js";
import progressTrackingRoutes from "./routes/progressTracking.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import reportRoutes from "./routes/report.routes.js";
import nutritionRoutes from "./routes/nutrition.routes.js";
import paypalRoutes from "./routes/paypal.routes.js";
import notificationRoutes from "./routes/notification.route.js";

// Load environment variables
dotenv.config();

// Connect to database
connectDB();
connectCloudinary();
checkEdamamStatus();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/user/history", userHistoryRoutes);

// Comment and Rating routes
app.use("/api/comments", commentDeleteRouter);
app.use("/api/ratings", ratingDeleteRouter);

// Subscription routes
app.use("/api/subscriptions", subscriptionRoutes);

// AI routes
app.use("/api/ai", aiRoutes);

// Meal plan routes
app.use("/api/mealplans", mealplanRoutes);

// Goal routes
app.use("/api/goals", goalRoutes);

// Progress tracking routes
app.use("/api/progress", progressTrackingRoutes);

// Blog routes
app.use("/api/blogs", blogRoutes);

// Nutrition routes
app.use("/api/nutrition", nutritionRoutes);

// Admin routes
app.use("/api/admin", adminRoutes);

// Feedback routes
app.use("/api/feedback", feedbackRoutes);

// Report routes
app.use("/api/report", reportRoutes);

// PayPal payment routes
app.use("/api/paypal", paypalRoutes);

// Notification routes
app.use("/api/notifications", notificationRoutes);

// Status route
app.get("/", async (req, res) => {
  try {
    console.log("Server is running successfully on huggingface");
    res.status(200).json({
      success: true,
      message: "Server is running successfully",
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("=== ERROR HANDLING MIDDLEWARE ===");
  console.error("Error name:", err.name);
  console.error("Error message:", err.message);
  console.error("Error stack:", err.stack);
  console.error("Request body:", req.body);
  console.error("Request file:", req.file);
  
  // If response was already sent, don't send again
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({ 
    success: false,
    error: err.message || "Something went wrong!",
    details: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
