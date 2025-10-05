# Meta Meal Backend

Backend API cho hệ thống quản lý bữa ăn Meta Meal, sử dụng Node.js + Express + MongoDB.

## 🚀 Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình Database

Tạo file `.env` trong thư mục gốc (hoặc copy từ `.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017/metameal
JWT_SECRET=your-super-secret-jwt-key-change-this
PORT=5000
NODE_ENV=development
```

### 3. Cài đặt MongoDB

**Windows:**
- Tải MongoDB Community Server: https://www.mongodb.com/try/download/community
- Cài đặt và chạy MongoDB service
- Hoặc chạy bằng lệnh: `mongod`

**Kiểm tra MongoDB đang chạy:**
```bash
mongosh
# hoặc
mongo
```

### 4. Chạy server

```bash
# Development mode (auto restart)
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:5000`

## 📚 API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "123456"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "123456"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "username": "testuser",
      "email": "test@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Get Current User (Protected)
```http
GET /api/auth/me
Authorization: Bearer <token>
```

## 🧪 Test API

Bạn có thể test API bằng:
- **Postman**: Import collection và test các endpoints
- **Thunder Client** (VS Code extension)
- **cURL**:
  ```bash
  # Register
  curl -X POST http://localhost:5000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","email":"test@example.com","password":"123456"}'

  # Login
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"123456"}'
  ```

## 📁 Cấu trúc dự án

```
Meta_MealBE/
├── config/
│   └── db.js              # Database connection
├── controllers/
│   └── auth.controller.js # Auth logic
├── middleware/
│   └── auth.middleware.js # JWT authentication
├── models/
│   └── User.model.js      # User schema
├── routes/
│   └── auth.routes.js     # Auth routes
├── .env.example           # Environment variables template
├── server.js              # Main server file
└── package.json
```

## 🔐 Bảo mật

- Passwords được hash bằng `bcryptjs`
- JWT tokens expire sau 7 ngày
- CORS được enable cho frontend
- Environment variables cho sensitive data

## 🛠️ Tech Stack

- **Node.js** - Runtime
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables
