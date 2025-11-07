import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { connectCloudinary } from "./config/cloudinary.js";
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

// Load environment variables
dotenv.config();

// Connect to database
connectDB();
connectCloudinary();

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

// Status route
app.get("/", async (req, res) => {
  try {
    console.log("Server is running successfully on huggingface");
  } catch (error) {
    res.status(503).send(`❌ Error: ${error.message}`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
