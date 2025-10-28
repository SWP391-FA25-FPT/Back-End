import express from 'express';
import {
  createRecipe,
  getAllRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe,
  searchRecipes,
  addReaction,
  getDraftsByUser,
  getMyRecipes,
  updateRecipeStatus,
  toggleSaveRecipe,
  checkRecipeSaved
} from '../controllers/recipe.controller.js';
import { protect, optionalAuth, checkRecipeOwnership } from '../middleware/auth.middleware.js';
import { uploadRecipe } from '../config/cloudinary.js';
import commentRoutes from './comment.routes.js';
import ratingRoutes from './rating.routes.js';

const router = express.Router();

// My recipes routes (must come before public routes to avoid conflicts)
router.get('/my/drafts', protect, getDraftsByUser);
router.get('/my/:statusType', protect, getMyRecipes);

// Public routes
router.get('/search', searchRecipes);
router.get('/', getAllRecipes);
router.get('/:id', optionalAuth, getRecipeById); // Optional auth to check saved recipes
router.post('/:id/reactions', addReaction);

// Save recipe routes (protected)
router.post('/:id/save', protect, toggleSaveRecipe);
router.get('/:id/is-saved', protect, checkRecipeSaved);

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

router.patch('/:id/status', protect, updateRecipeStatus);

// Nested routes for comments and ratings
router.use('/:recipeId/comments', commentRoutes);
router.use('/:recipeId/ratings', ratingRoutes);

export default router;

