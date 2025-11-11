import express from 'express';
import {
  getMealPlans,
  generateMealPlan,
  regenerateMealPlan,
  generateWeeklyMealPlan,
  deleteMealPlan,
  deleteAllUserMealPlans,
  updateMealInPlan
} from '../controllers/mealplan.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get meal plans (by date or date range)
// Query params: ?date=YYYY-MM-DD or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/', getMealPlans);

// Generate a single day meal plan
router.post('/generate', generateMealPlan);

// Regenerate existing meal plan for a date
router.post('/regenerate', regenerateMealPlan);

// Generate weekly meal plan (7 days)
router.post('/weekly', generateWeeklyMealPlan);

// Delete all user meal plans (used when canceling goal)
// Must be before /:id route to avoid conflict
router.delete('/user/all', deleteAllUserMealPlans);

// Delete a meal plan
router.delete('/:id', deleteMealPlan);

// Update a specific meal in a meal plan
router.put('/:id/meals/:mealIndex', updateMealInPlan);

export default router;



