import mongoose from "mongoose"

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "VND",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["paypal", "credit_card", "debit_card", "other"],
      required: true,
    },
    paymentId: {
      type: String,
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
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema)
