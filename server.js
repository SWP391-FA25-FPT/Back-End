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
    
    res.send(`
      <h1>${statusEmoji} Meta-Meal API Status</h1>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <hr>
      <h2>Database (MongoDB)</h2>
      <ul>
        <li>Status: ${dbStatus.status === 'connected' ? '✅' : '❌'} ${dbStatus.status}</li>
        <li>Host: ${dbStatus.host}</li>
        <li>Database: ${dbStatus.database}</li>
      </ul>
      <h2>Cloudinary</h2>
      <ul>
        <li>Status: ${cloudinaryStatus.status === 'connected' ? '✅' : '❌'} ${cloudinaryStatus.status}</li>
        <li>Folder: ${cloudinaryStatus.folder || 'N/A'}</li>
        <li>Resources: ${cloudinaryStatus.resources || 'N/A'}</li>
        <li>Rate Limit: ${cloudinaryStatus.rate_limit_remaining || 'N/A'}</li>
      </ul>
    `);
  } catch (error) {
    res.status(503).send(`
      <h1>❌ Error</h1>
      <p>${error.message}</p>
    `);
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


