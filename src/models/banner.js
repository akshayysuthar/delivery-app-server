import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    image: { type: String, required: true },
    redirectType: {
      type: String,
      enum: ["subcategory", "category", "product", "url"],
      required: true,
    },
    targetId: { type: String }, // e.g. categoryId, productId, or full URL
    metadata: { type: mongoose.Schema.Types.Mixed }, // extra details (optional)
    title: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;
