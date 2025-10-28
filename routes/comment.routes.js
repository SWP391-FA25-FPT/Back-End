import express from 'express';
import {
  getCommentsByRecipeId,
  createComment,
  deleteComment
} from '../controllers/comment.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router({ mergeParams: true }); // mergeParams để access :recipeId từ parent router

// Routes for /api/recipes/:recipeId/comments
router.get('/', getCommentsByRecipeId);
router.post('/', protect, createComment);

// Route for /api/comments/:id
export const commentDeleteRouter = express.Router();
commentDeleteRouter.delete('/:id', protect, deleteComment);

export default router;

