import express from 'express';
import {
  getRatingsByRecipeId,
  createOrUpdateRating,
  deleteRating,
  deleteUserRating
} from '../controllers/rating.controller.js';
import { protect, optionalAuth } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true }); // mergeParams để access :recipeId từ parent router

// Routes for /api/recipes/:recipeId/ratings
router.get('/', optionalAuth, getRatingsByRecipeId); // optionalAuth để có thể lấy userRating nếu đăng nhập
router.post('/', protect, createOrUpdateRating);
router.delete('/', protect, deleteUserRating);

// Route for /api/ratings/:id
export const ratingDeleteRouter = express.Router();
ratingDeleteRouter.delete('/:id', protect, deleteRating);

export default router;

