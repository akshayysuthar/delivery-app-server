// models/CategorySection.js
import mongoose from "mongoose";

const categorySectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String },
  bgImage: { type: String }, // URL for banner or background
  headerImage: { type: String }, // URL for banner or background
  isRain: { type: Boolean },
  categories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // or 'SubCategory' if needed
    },
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory", // or 'SubCategory' if needed
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const CategorySection = mongoose.model(
  "CategorySection",
  categorySectionSchema
);
export default CategorySection;
