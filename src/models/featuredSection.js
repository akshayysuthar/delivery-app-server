// models/FeaturedSection.js
import mongoose from "mongoose";

const featuredSectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const FeaturedSection = mongoose.model(
  "FeaturedSection",
  featuredSectionSchema
);
export default FeaturedSection;
