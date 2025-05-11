import mongoose from "mongoose";

export const connectDB = async (url) => {
  try {
    await mongoose.connect(url, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      ssl: true
    });
    console.log("✅ DB connected");
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    console.error(error);
  }
};

