import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Blog from "../models/Blog.js";
import connectDB from "./db.js";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import blog data
const seedBlogs = async () => {
  try {
    // Read seed data
    const seedDataPath = path.join(__dirname, "../data/seedBlogs.json");
    const seedData = JSON.parse(fs.readFileSync(seedDataPath, "utf8"));

    // Clear existing blogs (optional - comment out if you want to keep existing data)
    // await Blog.deleteMany({});
    // console.log('🗑️  Cleared existing blogs');

    // Insert seed data
    console.log(`📝 Importing ${seedData.length} blogs...`);

    const blogs = await Blog.insertMany(seedData);
    console.log(`✅ Imported ${blogs.length} blogs successfully!`);
    console.log("Blog titles:");
    blogs.forEach((blog) => {
      console.log(`  - ${blog.title}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding blogs:", error);
    process.exit(1);
  }
};

// Run seed
const run = async () => {
  await connectDB();
  await seedBlogs();
};

run();
