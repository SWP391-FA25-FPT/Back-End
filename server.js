import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB, { checkDBStatus } from './config/db.js';
import { checkCloudinaryStatus } from './config/cloudinary.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

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
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Status route
app.get('/', async (req, res) => {
  try {
    const dbStatus = checkDBStatus();
    const cloudinaryStatus = await checkCloudinaryStatus();

    const allHealthy = 
      dbStatus.status === 'connected' && 
      cloudinaryStatus.status === 'connected';

    const statusEmoji = allHealthy ? '✅' : '⚠️';
    
    res.send(
      `${statusEmoji} Meta-Meal API Status\n\n` +
      `Time: ${new Date().toLocaleString()}\n\n` +
      `--- Database (MongoDB) ---\n` +
      `Status: ${dbStatus.status === 'connected' ? '✅' : '❌'} ${dbStatus.status}\n` +
      `Host: ${dbStatus.host}\n` +
      `Database: ${dbStatus.database}\n\n` +
      `--- Cloudinary ---\n` +
      `Status: ${cloudinaryStatus.status === 'connected' ? '✅' : '❌'} ${cloudinaryStatus.status}\n` +
      `Folder: ${cloudinaryStatus.folder || 'N/A'}\n` +
      `Resources: ${cloudinaryStatus.resources || 'N/A'}\n` +
      `Rate Limit: ${cloudinaryStatus.rate_limit_remaining || 'N/A'}`
    );
  } catch (error) {
    res.status(503).send(`❌ Error: ${error.message}`);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 7860;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});


