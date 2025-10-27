import express from 'express';
import {
  createRecipe,
  getAllRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  searchRecipes,
  addReaction
} from '../controllers/recipe.controller.js';
import { protect, checkRecipeOwnership } from '../middleware/auth.middleware.js';
import { uploadRecipe } from '../config/cloudinary.js';
import commentRoutes from './comment.routes.js';
import ratingRoutes from './rating.routes.js';

const router = express.Router();

// Public routes
router.get('/search', searchRecipes);
router.get('/', getAllRecipes);
router.get('/:id', getRecipeById);
router.post('/:id/reactions', addReaction);

// Protected routes (require authentication)
router.post(
  '/',
  protect,
  uploadRecipe.fields([
    { name: 'image', maxCount: 1 },
    { name: 'stepImages', maxCount: 20 }
  ]),
  createRecipe
);

router.put(
  '/:id',
  protect,
  checkRecipeOwnership,
  uploadRecipe.fields([
    { name: 'image', maxCount: 1 },
    { name: 'stepImages', maxCount: 20 }
  ]),
  updateRecipe
);

router.delete('/:id', protect, checkRecipeOwnership, deleteRecipe);

// Nested routes for comments and ratings
router.use('/:recipeId/comments', commentRoutes);
router.use('/:recipeId/ratings', ratingRoutes);

export default router;

