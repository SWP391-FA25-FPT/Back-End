import Subscription from "../models/Subscription.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.model.js";

// Định nghĩa các gói subscription
export const SUBSCRIPTION_PLANS = {
  basic: {
    monthly: { price: 99000, name: "Basic Monthly" },
    yearly: { price: 990000, name: "Basic Yearly" },
  },
  premium: {
    monthly: { price: 199000, name: "Premium Monthly" },
    yearly: { price: 1990000, name: "Premium Yearly" },
    lifetime: { price: 4990000, name: "Premium Lifetime" },
  },
};

// Tạo subscription mới
export const createSubscription = async (req, res) => {
  try {
    const { planType, planDuration, paymentMethod } = req.body;
    const userId = req.user._id;

    // Validate plan
    if (!SUBSCRIPTION_PLANS[planType] || !SUBSCRIPTION_PLANS[planType][planDuration]) {
      return res.status(400).json({
        success: false,
        error: "Gói subscription không hợp lệ",
      });
    }

    // Kiểm tra subscription hiện tại
    const existingSubscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "pending"] },
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: "Bạn đã có subscription đang hoạt động",
      });
    }

    const planInfo = SUBSCRIPTION_PLANS[planType][planDuration];

    // Tính endDate
    let endDate = new Date();
    if (planDuration === "monthly") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (planDuration === "yearly") {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (planDuration === "lifetime") {
      endDate.setFullYear(endDate.getFullYear() + 100); // 100 năm cho lifetime
    }

    // Tạo transaction
    const transaction = await Transaction.create({
      userId,
      amount: planInfo.price,
      currency: "VND",
      status: "pending",
      paymentMethod,
      planType,
      planDuration,
      metadata: {
        planName: planInfo.name,
      },
    });

    // Tạo subscription
    const subscription = await Subscription.create({
      userId,
      planType,
      planDuration,
      status: "pending",
      endDate,
      paymentMethod,
      paymentId: transaction._id,
      metadata: {
        price: planInfo.price,
        planName: planInfo.name,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        subscription,
        transaction,
      },
      message: "Subscription đã được tạo, vui lòng thanh toán",
    });
  } catch (error) {
    console.error("Create subscription error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi tạo subscription",
    });
  }
};

// Confirm payment và kích hoạt subscription
export const confirmPayment = async (req, res) => {
  try {
    const { subscriptionId, paymentId } = req.body;
    const userId = req.user._id;

    // Tìm subscription
    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId,
      status: "pending",
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription không tồn tại hoặc đã được kích hoạt",
      });
    }

    // Update transaction
    await Transaction.findByIdAndUpdate(subscription.paymentId, {
      status: "completed",
      paymentId,
    });

    // Kích hoạt subscription
    subscription.status = "active";
    subscription.startDate = new Date();
    await subscription.save();

    // Update user subscription status
    await User.findByIdAndUpdate(userId, {
      "subscription.status": "sub",
      "subscription.stripeSubscriptionId": subscriptionId,
    });

    res.status(200).json({
      success: true,
      data: subscription,
      message: "Thanh toán thành công, subscription đã được kích hoạt",
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi xác nhận thanh toán",
    });
  }
};

// Lấy subscription của user hiện tại
export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "pending"] },
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "Không có subscription nào",
      });
    }

    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    console.error("Get my subscription error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy thông tin subscription",
    });
  }
};

// Hủy subscription
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user._id;

    const subscription = await Subscription.findOne({
      _id: subscriptionId,
      userId,
      status: "active",
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: "Subscription không tồn tại hoặc đã hủy",
      });
    }

    // Update subscription
    subscription.status = "canceled";
    subscription.canceledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    // Update user subscription status
    await User.findByIdAndUpdate(userId, {
      "subscription.status": "free",
    });

    res.status(200).json({
      success: true,
      data: subscription,
      message: "Subscription đã được hủy",
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi hủy subscription",
    });
  }
};

// Lấy lịch sử subscription
export const getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscriptions = await Subscription.find({ userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    console.error("Get subscription history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy lịch sử subscription",
    });
  }
};

// Lấy lịch sử giao dịch
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const transactions = await Transaction.find({ userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error("Get transaction history error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy lịch sử giao dịch",
    });
  }
};

// Lấy tất cả plans
export const getSubscriptionPlans = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: SUBSCRIPTION_PLANS,
    });
  } catch (error) {
    console.error("Get subscription plans error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách gói",
    });
  }
};

// Admin: Lấy tất cả subscriptions
export const getAllSubscriptions = async (req, res) => {
  try {
    const { status, planType } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (planType) filter.planType = planType;

    const subscriptions = await Subscription.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error("Get all subscriptions error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi lấy danh sách subscription",
    });
  }
};

// Kiểm tra và cập nhật subscription hết hạn (cron job)
export const checkExpiredSubscriptions = async (req, res) => {
  try {
    const now = new Date();

    // Tìm các subscription đã hết hạn nhưng vẫn active
    const expiredSubscriptions = await Subscription.find({
      status: "active",
      endDate: { $lt: now },
    });

    // Update từng subscription
    for (const subscription of expiredSubscriptions) {
      subscription.status = "expired";
      await subscription.save();

      // Update user status
      await User.findByIdAndUpdate(subscription.userId, {
        "subscription.status": "free",
      });
    }

    res.status(200).json({
      success: true,
      message: `Đã cập nhật ${expiredSubscriptions.length} subscription hết hạn`,
      count: expiredSubscriptions.length,
    });
  } catch (error) {
    console.error("Check expired subscriptions error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Lỗi khi kiểm tra subscription hết hạn",
    });
  }
};


