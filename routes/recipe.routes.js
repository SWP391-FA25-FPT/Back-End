import express from 'express';
import {
  createRecipe,
  getAllRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe
} from '../controllers/recipe.controller.js';
import { protect, checkRecipeOwnership } from '../middleware/auth.middleware.js';
import { uploadRecipe } from '../config/cloudinary.js';

const router = express.Router();

// Public routes
router.get('/', getAllRecipes);
router.get('/:id', getRecipeById);

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

export default router;

