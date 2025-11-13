import express from 'express';
import * as paypalController from '../controllers/paypal.controller.js';

const router = express.Router();
// Create PayPal order
router.post('/create-order', paypalController.createOrder);
// Capture PayPal order
router.post('/capture-order', paypalController.captureOrder);

export default router;
