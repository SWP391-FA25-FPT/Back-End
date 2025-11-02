import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB, { checkDBStatus } from "./config/db.js";
import { checkCloudinaryStatus } from "./config/cloudinary.js";
import { checkAIHealth } from "./controllers/ai.controller.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import recipeRoutes from "./routes/recipe.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import userHistoryRoutes from "./routes/userHistory.routes.js";
import commentRoutes, { commentDeleteRouter } from "./routes/comment.routes.js";
import ratingRoutes, { ratingDeleteRouter } from "./routes/rating.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import aiRoutes from "./routes/ai.routes.js";


// Load environment variables
dotenv.config();

// Connect to database
connectDB();

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

// Status route
app.get("/", async (req, res) => {
  try {
    const dbStatus = checkDBStatus();
    const cloudinaryStatus = await checkCloudinaryStatus();
    const aiStatus = await checkAIHealth();
    const allHealthy =
      dbStatus.status === "connected" &&
      cloudinaryStatus.status === "connected" &&
      aiStatus.status === "connected";

    const statusEmoji = allHealthy ? "✅" : "⚠️";

    res.send(`<pre>
${statusEmoji} Meta-Meal API Status

Time: ${new Date().toLocaleString()}

--- Database (MongoDB) ---
Status: ${dbStatus.status === "connected" ? "✅" : "❌"} ${dbStatus.status}
Host: ${dbStatus.host}
Database: ${dbStatus.database}

--- Cloudinary ---
Status: ${cloudinaryStatus.status === "connected" ? "✅" : "❌"} ${
      cloudinaryStatus.status
    }
Folder: ${cloudinaryStatus.folder || "N/A"}
Resources: ${cloudinaryStatus.resources || "N/A"}
Rate Limit: ${cloudinaryStatus.rate_limit_remaining || "N/A"}

--- AI ---
Status: ${aiStatus.status === "connected" ? "✅" : "❌"} ${aiStatus.status}
Model: ${aiStatus.model || "N/A"}
Rate Limit: ${aiStatus.rate_limit_remaining || "N/A"}
</pre>`
);
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
