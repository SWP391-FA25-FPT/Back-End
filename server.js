import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// === THÊM VÀO: Import HTTP và Socket.IO ===
import http from "http";
import { Server } from "socket.io";
// === KẾT THÚC THÊM VÀO ===

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
import nutritionRoutes from "./routes/nutrition.routes.js";
import paypalRoutes from "./routes/paypal.routes.js";
import notificationRoutes from "./routes/notification.route.js";
import challengeRoutes from "./routes/challenge.routes.js";

// Import router chat duy nhất của bạn
import chatRoutes from "./routes/message.routes.js"; 

// Load environment variables
dotenv.config();

// Connect to database
connectDB();
connectCloudinary();
checkEdamamStatus();

const app = express();

// === THÊM VÀO: Khởi tạo HTTP Server và Socket.IO ===
const httpServer = http.createServer(app); 

const io = new Server(httpServer, {
  cors: {
    origin: "*", // Cho phép mọi nguồn (sau này nên đổi thành URL frontend)
    methods: ["GET", "POST"]
  }
});

// Gán io và activeUsers vào global để Controller có thể truy cập
// (message.controller.js của bạn đang cần 2 biến này)
global.io = io; 
global.activeUsers = new Map(); // Map: key=userId, value=socketId

// Xử lý logic Socket.IO
io.on("connection", (socket) => {
  console.log(`Một người dùng đã kết nối: ${socket.id}`);

  // Lắng nghe sự kiện "join" (hoặc tên gì đó bạn đặt ở frontend)
  socket.on("join", (userId) => {
    if (userId) {
        console.log(`User ${userId} đã tham gia với socket ${socket.id}`);
        global.activeUsers.set(userId, socket.id);
        
        // Phát sự kiện cho mọi người biết danh sách user đang online
        io.emit("activeUsersUpdate", Array.from(global.activeUsers.keys()));
    }
  });

  // Xử lý khi client ngắt kết nối
  socket.on("disconnect", () => {
    console.log(`Người dùng đã ngắt kết nối: ${socket.id}`);
    // Xóa user khỏi activeUsers
    for (let [userId, socketId] of global.activeUsers.entries()) {
      if (socketId === socket.id) {
        global.activeUsers.delete(userId);
        // Cập nhật lại danh sách online cho mọi người
        io.emit("activeUsersUpdate", Array.from(global.activeUsers.keys()));
        break;
      }
    }
  });
});
// === KẾT THÚC THÊM VÀO ===


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


// === SỬA Ở ĐÂY: Gắn router chat vào đúng đường dẫn mà frontend đang gọi ===
app.use("/api/conversations", chatRoutes); 


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

// === SỬA Ở ĐÂY: Dùng httpServer.listen thay vì app.listen ===
httpServer.listen(PORT, () => {
  console.log(`🚀 Server (và Socket.IO) đang chạy trên cổng ${PORT}`);
});