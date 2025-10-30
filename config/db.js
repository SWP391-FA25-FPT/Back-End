import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || "mongodb+srv://phongltt0203:bonnehihi123@ecchan.za1shup.mongodb.net/metameal?retryWrites=true&w=majority&appName=ecchan",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Function kiểm tra status
export const checkDBStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    status: states[state] || "unknown",
    host: mongoose.connection.host || "N/A",
    database: mongoose.connection.name || "N/A",
  };
};

export default connectDB;
