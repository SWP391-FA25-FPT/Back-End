import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import { connectCloudinary } from "./config/cloudinary.js";
import { checkEdamamStatus } from "./config/edamam.config.js";

// === IMPORT CÁC ROUTES ===
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
import nutritionRoutes from "./routes/nutrition.routes.js";
import paypalRoutes from "./routes/paypal.routes.js";
import notificationRoutes from "./routes/notification.route.js";
import challengeRoutes from "./routes/challenge.routes.js";
import chatRoutes from "./routes/message.routes.js"; 
import friendRoutes from "./routes/friend.routes.js"; // === THÊM DÒNG NÀY ===

// Load environment variables
dotenv.config();

// Connect to database
connectDB();
connectCloudinary();
checkEdamamStatus();

const app = express();

// === Khởi tạo HTTP Server và Socket.IO ===
const httpServer = http.createServer(app); 

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Cho phép mọi nguồn (sau này nên đổi thành URL frontend)
    methods: ["GET", "POST"]
  }
});

// Gán io và activeUsers vào global
global.io = io; 
global.activeUsers = new Map(); 

// Xử lý logic Socket.IO
io.on("connection", (socket) => {
  console.log(`Một người dùng đã kết nối: ${socket.id}`);

  socket.on("join", (userId) => {
    if (userId) {
        console.log(`User ${userId} đã tham gia với socket ${socket.id}`);
        global.activeUsers.set(userId, socket.id);
        
        io.emit("activeUsersUpdate", Array.from(global.activeUsers.keys()));
    }
  });

  socket.on("disconnect", () => {
    console.log(`Người dùng đã ngắt kết nối: ${socket.id}`);
    for (let [userId, socketId] of global.activeUsers.entries()) {
      if (socketId === socket.id) {
        global.activeUsers.delete(userId);
        io.emit("activeUsersUpdate", Array.from(global.activeUsers.keys()));
        break;
      }
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === SỬ DỤNG CÁC ROUTES ===
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/user/history", userHistoryRoutes);
app.use("/api/comments", commentDeleteRouter);
app.use("/api/ratings", ratingDeleteRouter);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/mealplans", mealplanRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/progress", progressTrackingRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/nutrition", nutritionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/conversations", chatRoutes); 

app.use("/api/friends", friendRoutes); // === THÊM DÒNG NÀY ===

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

// Dùng httpServer.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Server (và Socket.IO) đang chạy trên cổng ${PORT}`);
});