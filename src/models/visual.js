import mongoose from "mongoose";

const visualConfigSchema = new mongoose.Schema({
  bgImageUrl: { type: String, default: "" }, // URL or local asset path
  lottieAnimationUrl: { type: String, default: "" }, // URL or local asset path
  gradientColors: [{ type: String, default: "#000000" }], // array of colors
  animationHeight: { type: Number, default: 150 }, // height of lottie animation
  cloudImageUrl: { type: String, default: "" }, // optional cloud image URL
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const VisualConfig = mongoose.model("VisualConfig", visualConfigSchema);
export default VisualConfig;
