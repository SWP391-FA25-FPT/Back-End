import express from 'express';
import {
  createGoal,
  getGoals,
  getActiveGoal,
  getGoalById,
  updateGoal,
  completeGoal,
  cancelGoal
} from '../controllers/goal.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create and get goals
router.route('/')
  .post(createGoal)
  .get(getGoals);

// Get active goal
router.get('/active', getActiveGoal);

// Complete goal
router.put('/:id/complete', completeGoal);

// Get, update, delete specific goal
router.route('/:id')
  .get(getGoalById)
  .put(updateGoal)
  .delete(cancelGoal);

export default router;



