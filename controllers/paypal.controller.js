// PayPal payment controller for handling order creation and capture
import paypal from '@paypal/checkout-server-sdk';
const { core, orders } = paypal;
import dotenv from 'dotenv';
import Transaction from '../models/Transaction.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.model.js';
dotenv.config();

// PayPal environment setup
const environment = process.env.PAYPAL_MODE === 'live'
  ? new core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
  : new core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
const client = new core.PayPalHttpClient(environment);

// Create PayPal order
export const createOrder = async (req, res) => {
  const { amount, currency = 'USD', planType, planDuration } = req.body;
  const request = new orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{ 
      amount: { currency_code: currency, value: amount },
      description: `${planType} - ${planDuration} subscription`
    }],
    application_context: {
      return_url: process.env.PAYPAL_RETURN_URL || 'http://localhost:5173/subscription?payment=success',
      cancel_url: process.env.PAYPAL_CANCEL_URL || 'http://localhost:5173/subscription?payment=cancel',
    },
  });
  try {
    const order = await client.execute(request);
    // Find approval URL
    const approvalUrl = order.result.links.find(link => link.rel === 'approve')?.href;
    res.json({ 
      id: order.result.id, 
      approvalUrl,
      planType,
      planDuration
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Capture PayPal order and create subscription
export const captureOrder = async (req, res) => {
  const { orderID, planType, planDuration, userId } = req.body;
  
  if (!userId || !planType || !planDuration) {
    return res.status(400).json({ error: 'Missing required fields: userId, planType, planDuration' });
  }

  // Check if this order was already processed
  const existingTransaction = await Transaction.findOne({ 'metadata.orderId': orderID });
  if (existingTransaction) {
    return res.json({ 
      success: true,
      status: 'ALREADY_PROCESSED', 
      transaction: existingTransaction,
      message: 'Payment already processed'
    });
  }

  const request = new orders.OrdersCaptureRequest(orderID);
  request.requestBody({});
  
  try {
    const capture = await client.execute(request);
    
    // Check if payment was successful
    if (capture.result.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Get payment details
    const paymentDetails = capture.result.purchase_units[0].payments.captures[0];
    const amount = parseFloat(paymentDetails.amount.value);
    const currency = paymentDetails.amount.currency_code;
    const paymentId = paymentDetails.id;

    // Calculate subscription end date
    let endDate = new Date();
    if (planDuration === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (planDuration === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (planDuration === 'lifetime') {
      endDate.setFullYear(endDate.getFullYear() + 100); // 100 years for lifetime
    }

    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      amount,
      currency,
      status: 'completed',
      paymentMethod: 'paypal',
      paymentId,
      planType,
      planDuration,
      metadata: {
        orderId: orderID,
        captureId: paymentId,
        paypalDetails: capture.result
      }
    });

    // Create or update subscription
    const existingSubscription = await Subscription.findOne({ userId, status: 'active' });
    
    if (existingSubscription) {
      // Update existing subscription
      existingSubscription.planType = planType;
      existingSubscription.planDuration = planDuration;
      existingSubscription.endDate = endDate;
      existingSubscription.paymentMethod = 'paypal';
      existingSubscription.paymentId = paymentId;
      existingSubscription.status = 'active';
      await existingSubscription.save();
    } else {
      // Create new subscription
      await Subscription.create({
        userId,
        planType,
        planDuration,
        status: 'active',
        startDate: new Date(),
        endDate,
        paymentMethod: 'paypal',
        paymentId,
        metadata: {
          transactionId: transaction._id
        }
      });
    }

    // Update user subscription status
    await User.findByIdAndUpdate(userId, {
      'subscription.status': planType,
      'subscription.stripeSubscriptionId': paymentId // Store PayPal payment ID here
    });

    res.json({ 
      success: true,
      status: 'COMPLETED', 
      transaction,
      message: 'Payment successful and subscription activated'
    });
  } catch (err) {
    console.error('PayPal capture error:', err);
    
    // Handle already captured orders gracefully
    if (err.message && err.message.includes('ORDER_ALREADY_CAPTURED')) {
      const existingTransaction = await Transaction.findOne({ 'metadata.orderId': orderID });
      if (existingTransaction) {
        return res.json({ 
          success: true,
          status: 'ALREADY_PROCESSED', 
          transaction: existingTransaction,
          message: 'Payment already processed'
        });
      }
    }
    
    res.status(500).json({ error: err.message });
  }
};
