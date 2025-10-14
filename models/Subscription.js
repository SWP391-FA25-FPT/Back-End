import mongoose from "mongoose"

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planType: {
      type: String,
      required: true,
    },
    planDuration: {
      type: String,
      enum: ["monthly", "yearly", "lifetime"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "canceled", "expired", "pending"],
      default: "pending",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      enum: ["paypal", "credit_card", "debit_card", "other"],
      required: true,
    },
    paymentId: {
      type: String,
    },
    canceledAt: {
      type: Date,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.models.Subscription || mongoose.model("Subscription", SubscriptionSchema)
