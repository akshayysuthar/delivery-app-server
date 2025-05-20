import mongoose from "mongoose";

const offerSchema = new mongoose.Schema({
  type: { type: String, enum: ["order", "product"], required: true },
  title: { type: String, required: true },
  code: String,
  minOrderValue: Number,
  discountValue: Number,
  productIds: [String],
  freebie: {
    productId: String,
    quantity: Number,
  },
  validTill: Date,
  isActive: { type: Boolean, default: true },
});

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
