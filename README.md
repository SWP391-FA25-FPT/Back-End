---
title: Meta-Meal
emoji: 🍽️
colorFrom: green
colorTo: blue
sdk: docker
sdk_version: "latest"
app_file: server.js
pinned: false
---

# 🍽️ Meta-Meal Backend API

Backend service cho ứng dụng Meta-Meal - Nền tảng Quản lý Dinh dưỡng & Kế hoạch Ăn uống Thông minh.

## 📋 Tổng quan

Backend được xây dựng với Node.js/Express.js, cung cấp RESTful API cho toàn bộ chức năng của hệ thống Meta-Meal, bao gồm:

- 🔐 Authentication & Authorization (JWT + OAuth)
- 🤖 AI Chat với Gemini AI + RAG (Qdrant)
- 🍳 Recipe Management
- 📊 Nutrition Analysis (Edamam API)
- 📅 Meal Planning
- 🎯 Goal & Progress Tracking
- 🏆 Challenge System
- 📝 Blog & Community
- 💬 Real-time Messaging (Socket.IO)
- 💳 Payment Processing (PayPal)
- 🖼️ Image Storage (Cloudinary)
- 📈 Analytics & Statistics

## 🏗️ Kiến trúc

```
Back-End/
├── config/                 # Configuration files
│   ├── ai.config.js       # Gemini AI configuration
│   ├── cloudinary.js      # Cloudinary setup
│   ├── db.js              # MongoDB connection
│   ├── edamam.config.js   # Edamam Nutrition API
│   └── qdrant.js          # Qdrant Vector DB
│
├── controllers/           # Business logic
│   ├── ai.controller.js          # AI chat & RAG
│   ├── auth.controller.js        # Authentication
│   ├── user.controller.js        # User management
│   ├── recipe.controller.js      # Recipe CRUD
│   ├── mealplan.controller.js    # Meal planning
│   ├── nutrition.controller.js   # Nutrition analysis
│   ├── challenge.controller.js   # Challenge system
│   ├── blog.controller.js        # Blog posts
│   ├── message.controller.js     # Real-time chat
│   ├── subscription.controller.js # Premium subscriptions
│   ├── paypal.controller.js      # Payment processing
│   ├── analytics.controller.js   # Analytics & stats
│   └── ...
│
├── models/                # Mongoose schemas
│   ├── User.model.js
│   ├── Recipe.js
│   ├── MealPlan.js
│   ├── Goal.js
│   ├── ProgressTracking.js
│   ├── Challenge.js
│   ├── Blog.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── Subscription.js
│   ├── Analytics.js
│   └── ...
│
├── routes/                # API routes
│   ├── auth.routes.js
│   ├── ai.routes.js
│   ├── recipe.routes.js
│   ├── mealplan.routes.js
│   ├── challenge.routes.js
│   ├── message.routes.js
│   └── ...
│
├── middleware/            # Express middleware
│   └── auth.middleware.js      # JWT verification
│
├── utils/                 # Helper functions
│   ├── embeddings.js           # Text → Vector embeddings
│   ├── recipeAI.js             # Recipe AI logic
│   ├── qdrant.js               # Qdrant operations
│   ├── nutritionService.js     # Nutrition calculations
│   ├── notificationService.js  # Push notifications
│   ├── authUtils.js            # Auth helpers
│   └── goalValidation.js       # Goal validation
│
├── server.js              # Entry point + Socket.IO setup
├── package.json
├── Dockerfile
└── .env.example
```

## 🛠️ Tech Stack

### Core
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js 4.18.2
- **Database**: MongoDB 8.0 with Mongoose

### AI & ML
- **AI Engine**: Google Gemini AI (`@google/generative-ai`)
- **Vector DB**: Qdrant (`@qdrant/js-client-rest`)
- **Embeddings**: Google text-embedding-004 (768 dimensions)
- **RAG**: Custom implementation for recipe recommendations

### External APIs
- **Nutrition**: Edamam Nutrition Analysis API
- **Payment**: PayPal Checkout Server SDK
- **Storage**: Cloudinary (images)
- **Email**: EmailJS
- **Translation**: Google Translate API

### Real-time
- **WebSocket**: Socket.IO 4.8.1
- **Active Users**: Map-based tracking

### Security
- **Authentication**: JSON Web Tokens (jsonwebtoken)
- **Password**: bcryptjs (hashing)
- **OAuth**: Google Auth Library

### File Upload
- **Middleware**: Multer
- **Storage**: Cloudinary with multer-storage-cloudinary

### Development
- **Hot Reload**: Nodemon
- **Environment**: dotenv

## 🚀 Quick Start

### 1. Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- MongoDB >= 6.0 (local or Atlas)
- Qdrant (Docker or Cloud)

### 2. Installation

```bash
# Clone repository
git clone https://github.com/yourusername/meta-meal.git
cd meta-meal/Back-End

# Install dependencies
npm install
```

### 3. Environment Setup

Tạo file `.env` trong thư mục `Back-End`:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=7860
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ============================================
# DATABASE
# ============================================
# Local MongoDB
MONGODB_URI=mongodb://localhost:27017/metameal

# MongoDB Atlas (Production)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/metameal?retryWrites=true&w=majority

# ============================================
# JWT AUTHENTICATION
# ============================================
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_EXPIRE=7d

# ============================================
# GOOGLE OAUTH
# ============================================
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ============================================
# AI CONFIGURATION - GEMINI
# ============================================
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio

# ============================================
# QDRANT VECTOR DATABASE
# ============================================
# Local Qdrant
QDRANT_URL=http://localhost:6333

# Qdrant Cloud (Production)
# QDRANT_URL=https://your-cluster-id.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION=ai_conversations
QDRANT_VECTOR_SIZE=768
QDRANT_DEBUG=false

# ============================================
# CLOUDINARY (Image Storage)
# ============================================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ============================================
# EDAMAM NUTRITION API
# ============================================
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key
EDAMAM_BASE_URL=https://api.edamam.com/api/nutrition-details

# ============================================
# PAYPAL PAYMENT
# ============================================
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
# Change to 'live' for production

# ============================================
# EMAIL SERVICE (EmailJS)
# ============================================
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

### 4. Start Qdrant (Docker)

```bash
# Pull và chạy Qdrant
docker run -d -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  --name qdrant \
  qdrant/qdrant

# Kiểm tra status
curl http://localhost:6333
```

### 5. Start MongoDB

```bash
# Nếu dùng local MongoDB
mongod

# Hoặc dùng MongoDB Atlas (cloud) - không cần chạy gì
```

### 6. Run Server

```bash
# Development (với hot reload)
npm run dev

# Production
npm start
```

Server sẽ chạy tại: `http://localhost:7860`

## 📡 API Endpoints

### Base URL
```
http://localhost:7860/api
```

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Đăng ký tài khoản mới | ❌ |
| POST | `/verify-otp` | Xác thực OTP | ❌ |
| POST | `/resend-otp` | Gửi lại OTP | ❌ |
| POST | `/login` | Đăng nhập | ❌ |
| POST | `/google` | Google OAuth login | ❌ |
| POST | `/forgot-password` | Quên mật khẩu | ❌ |
| POST | `/reset-password` | Reset mật khẩu | ❌ |
| GET | `/me` | Thông tin user hiện tại | ✅ |

### 👤 User Management (`/api/user`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/profile` | Lấy profile | ✅ |
| PUT | `/profile` | Cập nhật profile | ✅ |
| POST | `/complete-onboarding` | Hoàn thành survey | ✅ |
| GET | `/history/recent` | Lịch sử xem gần đây | ✅ |
| POST | `/history/view` | Thêm history | ✅ |
| DELETE | `/history/clear` | Xóa history | ✅ |

### 🍳 Recipes (`/api/recipes`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách recipes | ❌ |
| GET | `/:id` | Chi tiết recipe | ❌ |
| POST | `/` | Tạo recipe mới | ✅ |
| PUT | `/:id` | Cập nhật recipe | ✅ |
| DELETE | `/:id` | Xóa recipe | ✅ |
| GET | `/search` | Tìm kiếm recipes | ❌ |
| POST | `/:id/comments` | Thêm comment | ✅ |
| GET | `/:id/comments` | Lấy comments | ❌ |
| POST | `/:id/ratings` | Đánh giá recipe | ✅ |
| GET | `/:id/ratings` | Lấy ratings | ❌ |

### 🤖 AI Chat (`/api/ai`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/chat` | Chat với AI (RAG) | ✅ |
| GET | `/chat/conversations` | Danh sách conversations | ✅ |
| GET | `/chat/conversations/:id` | Chi tiết conversation | ✅ |
| GET | `/models` | Danh sách AI models | ✅ |
| GET | `/health` | Health check AI | ❌ |

### 📅 Meal Plans (`/api/mealplans`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách meal plans | ✅ |
| GET | `/:id` | Chi tiết meal plan | ✅ |
| POST | `/` | Tạo meal plan mới | ✅ |
| PUT | `/:id` | Cập nhật meal plan | ✅ |
| DELETE | `/:id` | Xóa meal plan | ✅ |
| GET | `/current` | Meal plan hiện tại | ✅ |

### 🎯 Goals (`/api/goals`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách goals | ✅ |
| POST | `/` | Tạo goal mới | ✅ |
| PUT | `/:id` | Cập nhật goal | ✅ |
| DELETE | `/:id` | Xóa goal | ✅ |
| GET | `/active` | Goals đang active | ✅ |

### 📊 Progress Tracking (`/api/progress`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Lịch sử tracking | ✅ |
| POST | `/` | Thêm điểm tracking | ✅ |
| GET | `/stats` | Thống kê tiến trình | ✅ |
| GET | `/charts` | Dữ liệu biểu đồ | ✅ |

### 🏆 Challenges (`/api/challenges`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách challenges | ❌ |
| GET | `/:id` | Chi tiết challenge | ❌ |
| POST | `/` | Tạo challenge | ✅ Admin |
| POST | `/:id/join` | Tham gia challenge | ✅ |
| POST | `/:id/entry` | Submit entry | ✅ |
| POST | `/:id/entry/:entryId/like` | Like entry | ✅ |
| GET | `/stats` | Thống kê challenges | ✅ |

### 📝 Blog (`/api/blogs`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách blogs | ❌ |
| GET | `/:id` | Chi tiết blog | ❌ |
| POST | `/` | Tạo blog mới | ✅ |
| PUT | `/:id` | Cập nhật blog | ✅ |
| DELETE | `/:id` | Xóa blog | ✅ |
| GET | `/my` | Blogs của tôi | ✅ |
| POST | `/:id/like` | Like blog | ✅ |
| POST | `/:id/comment` | Comment blog | ✅ |

### 📊 Nutrition (`/api/nutrition`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/analyze` | Phân tích dinh dưỡng | ✅ |
| GET | `/search` | Tìm thực phẩm | ❌ |
| GET | `/daily-summary` | Tổng kết hàng ngày | ✅ |

### 💳 Subscriptions (`/api/subscriptions`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/plans` | Danh sách gói | ❌ |
| POST | `/create` | Tạo subscription | ✅ |
| POST | `/confirm-payment` | Xác nhận thanh toán | ✅ |
| GET | `/my-subscription` | Subscription hiện tại | ✅ |
| POST | `/cancel/:id` | Hủy subscription | ✅ |
| GET | `/history` | Lịch sử subscriptions | ✅ |
| GET | `/transactions` | Lịch sử giao dịch | ✅ |

### 💳 PayPal (`/api/paypal`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/create-order` | Tạo PayPal order | ✅ |
| POST | `/capture-order` | Capture payment | ✅ |

### 💬 Messages (`/api/conversations`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách conversations | ✅ |
| POST | `/` | Tạo conversation | ✅ |
| GET | `/:id/messages` | Lấy messages | ✅ |
| POST | `/:id/messages` | Gửi message | ✅ |

### 🔔 Notifications (`/api/notifications`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Danh sách notifications | ✅ |
| PUT | `/:id/read` | Đánh dấu đã đọc | ✅ |
| PUT | `/read-all` | Đọc tất cả | ✅ |
| DELETE | `/:id` | Xóa notification | ✅ |

### 👑 Admin (`/api/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/users` | Quản lý users | ✅ Admin |
| PUT | `/users/:id` | Cập nhật user | ✅ Admin |
| DELETE | `/users/:id` | Xóa user | ✅ Admin |
| GET | `/stats` | Thống kê hệ thống | ✅ Admin |
| GET | `/reports` | Báo cáo | ✅ Admin |
| GET | `/feedback` | Feedback users | ✅ Admin |

### 📈 Analytics (`/api/analytics`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/search` | Track search | ✅ |
| GET | `/trending-tags` | Tags trending | ❌ |
| GET | `/search-stats` | Thống kê search | ✅ Admin |

## 🔒 Authentication

### JWT Token

Tất cả endpoints yêu cầu authentication sẽ cần JWT token trong header:

```http
Authorization: Bearer <your_jwt_token>
```

Token được trả về sau khi login/register thành công và có thời gian sống 7 ngày.

### Middleware

```javascript
// auth.middleware.js
import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

## 🤖 AI Features Deep Dive

### RAG (Retrieval-Augmented Generation) Flow

```
1. User sends message
   ↓
2. Generate embedding (768d vector)
   using Google text-embedding-004
   ↓
3. Search Qdrant for similar recipes
   - Semantic search
   - Filter by user preferences
   - Top 10 results
   ↓
4. Build context
   - User conversation history (last 10 messages)
   - Found recipes
   - User profile (dietary preferences, allergies, goals)
   ↓
5. Send to Gemini AI
   - Model: gemini-2.5-flash
   - System prompt with RAG context
   - User message
   ↓
6. Generate response
   - Personalized recommendations
   - Recipe suggestions with IDs
   - Nutrition advice
   ↓
7. Store in Qdrant
   - Save conversation
   - Update user history
   ↓
8. Return response to client
```

### Embedding Generation

```javascript
// utils/embeddings.js
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateEmbedding(text) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  
  const result = await model.embedContent(text);
  return result.embedding.values; // 768-dimensional vector
}
```

### Recipe Search with Qdrant

```javascript
// utils/qdrant.js
import { qdrantClient, AI_CHAT_COLLECTION } from '../config/qdrant.js';

export async function searchSimilarRecipes(queryEmbedding, userId, limit = 10) {
  const searchResult = await qdrantClient.search(AI_CHAT_COLLECTION, {
    vector: queryEmbedding,
    filter: {
      must: [
        { key: 'type', match: { value: 'recipe' } }
      ]
    },
    limit,
    with_payload: true
  });
  
  return searchResult.map(r => r.payload);
}
```

## 🐳 Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 7860

CMD ["npm", "start"]
```

### Build & Run

```bash
# Build image
docker build -t meta-meal-backend .

# Run container
docker run -d -p 7860:7860 \
  --env-file .env \
  --name meta-meal-api \
  meta-meal-backend

# View logs
docker logs -f meta-meal-api
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  backend:
    build: ./Back-End
    ports:
      - "7860:7860"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/metameal
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - mongo
      - qdrant
  
  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
  
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage

volumes:
  mongo-data:
  qdrant-data:
```

## 🧪 Testing

### Manual Testing với cURL

```bash
# Health Check
curl http://localhost:7860/

# Register
curl -X POST http://localhost:7860/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","fullName":"Test User"}'

# Login
curl -X POST http://localhost:7860/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Get Recipes (with token)
curl http://localhost:7860/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# AI Chat
curl -X POST http://localhost:7860/api/ai/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Tôi muốn món ăn healthy cho bữa tối","conversationId":null}'
```

### Testing với Postman

Import collection: [Download Postman Collection](./postman_collection.json)

## 📊 Database Indexes

```javascript
// Indexes for performance
User: email (unique), role
Recipe: author, tags, verified, createdAt
MealPlan: user, startDate, endDate
Challenge: status, startDate, endDate
Blog: author, tags, createdAt
Conversation: participants, updatedAt
Message: conversation, createdAt
```

## 🔧 Troubleshooting

### Common Issues

**1. MongoDB Connection Failed**
```bash
# Check MongoDB is running
mongod --version
# or check Atlas connection string
```

**2. Qdrant Connection Error**
```bash
# Check Qdrant is running
docker ps | grep qdrant
# Test connection
curl http://localhost:6333
```

**3. Gemini API Error**
```bash
# Verify API key
echo $GEMINI_API_KEY
# Check quota at https://aistudio.google.com/
```

**4. Cloudinary Upload Failed**
```bash
# Verify credentials in .env
# Check file size < 10MB
# Ensure allowed formats: jpg, png, gif, webp
```

## 📝 Logging

```javascript
// Console logs cho debugging
✅ MongoDB Connected
✅ Cloudinary Connected
✅ Edamam API Connected
✅ Gemini AI Connected (Model: gemini-2.5-flash)
✅ Qdrant Connected (Collection: ai_conversations)
🚀 Server (và Socket.IO) đang chạy trên cổng 7860
```

## 🔐 Security Best Practices

- ✅ Environment variables cho sensitive data
- ✅ JWT tokens với expiration
- ✅ Password hashing với bcrypt (10 rounds)
- ✅ CORS configuration
- ✅ Input validation với Mongoose
- ✅ Rate limiting (TODO: implement)
- ✅ SQL injection protection (MongoDB)
- ✅ XSS protection
- ⚠️ TODO: Add helmet.js
- ⚠️ TODO: Add express-rate-limit
- ⚠️ TODO: Add express-mongo-sanitize

## 📈 Performance Optimization

- ✅ MongoDB indexing
- ✅ Lean queries
- ✅ Pagination
- ✅ Cloudinary CDN
- ✅ Vector caching (Qdrant)
- ⚠️ TODO: Redis caching
- ⚠️ TODO: Query result caching
- ⚠️ TODO: API response compression

## 🤝 Contributing

Xem [CONTRIBUTING.md](../CONTRIBUTING.md) để biết thêm chi tiết.

## 📄 License

MIT License - xem [LICENSE](../LICENSE)

## 📞 Support

- Email: support@metameal.com
- GitHub Issues: [Report Issue](https://github.com/yourusername/meta-meal/issues)
- Documentation: [Full Docs](../docs/README.md)

---

<div align="center">

**Made with ❤️ by Meta-Meal Team**

[⬆ Back to top](#-meta-meal-backend-api)

</div>