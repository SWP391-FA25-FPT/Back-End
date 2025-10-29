import mongoose from "mongoose";

// Define comment schema (without replies first)
const CommentSchema = new mongoose.Schema(
  {
    userId: String,
    author: String,
    content: String,
    createdAt: { type: Date, default: Date.now },
    parentId: { type: String, default: null },
  },
  { _id: true, id: true }
);

// Add replies as array of CommentSchema (after initial definition)
CommentSchema.add({
  replies: [CommentSchema],
});

const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String },
    content: { type: String, required: true },
    author: { type: String, required: true },
    authorAvatar: { type: String },
    authorId: { type: String },
    category: { type: String },
    imageUrl: { type: String },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    tags: [String],
    likes: [{ type: String }],
    comments: [CommentSchema],
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Blog || mongoose.model("Blog", BlogSchema);
