import mongoose from "mongoose";

const ChallengeEntrySchema = new mongoose.Schema(
  {
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: "Recipe" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: String, required: true },
    authorAvatar: { type: String, default: "" },
    title: { type: String, required: true },
    image: { type: String, default: "" },
    content: { type: String, default: "" }, // Cách nấu hoặc status
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    rating: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    isPremium: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ChallengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String, default: "" },
    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["ongoing", "upcoming", "ended"],
      default: "upcoming",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    host: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      avatar: { type: String, default: "" },
    },
    prizes: [
      {
        title: { type: String, required: true },
        description: { type: String, required: true },
      },
    ],
    prizeDetails: {
      note: { type: String, default: "" },
      items: { type: String, default: "" },
    },
    hashtags: [{ type: String }],
    requirements: [{ type: String }],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    entries: [ChallengeEntrySchema],
    winnerEntryId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Entry thắng giải
  },
  { timestamps: true }
);

// Index for better query performance
ChallengeSchema.index({ status: 1, startDate: 1, endDate: 1 });
ChallengeSchema.index({ category: 1 });
ChallengeSchema.index({ "host.userId": 1 });

// Virtual for participants count
ChallengeSchema.virtual("participantsCount").get(function () {
  return this.participants ? this.participants.length : 0;
});

// Virtual for entries count
ChallengeSchema.virtual("entriesCount").get(function () {
  return this.entries ? this.entries.length : 0;
});

// Method to calculate time left
ChallengeSchema.methods.getTimeLeft = function () {
  const now = new Date();
  const end = new Date(this.endDate);
  
  if (now > end) {
    return "Đã kết thúc";
  }
  
  const diff = end - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) {
    return `Còn ${days} ngày`;
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) {
    return `Còn ${hours} giờ`;
  }
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `Còn ${minutes} phút`;
};

// Method to update status based on dates
ChallengeSchema.methods.updateStatus = function () {
  const now = new Date();
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  if (now < start) {
    this.status = "upcoming";
  } else if (now >= start && now <= end) {
    this.status = "ongoing";
  } else {
    this.status = "ended";
  }
};

// Pre-save hook to update status
ChallengeSchema.pre("save", function (next) {
  this.updateStatus();
  next();
});

export default mongoose.models.Challenge ||
  mongoose.model("Challenge", ChallengeSchema);

