import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    code: { type: String, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },
    validTill: { type: Date },
    conditions: {
      minCartValue: { type: Number },
      requiredProducts: [
        { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      ],
      userType: { type: String, enum: ["all", "new", "existing"] },
      // Add more conditions as needed
    },
    rewards: {
      freeProduct: {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1 },
      },
      freeDelivery: { type: Boolean },
      discountValue: { type: Number },
      discountType: { type: String, enum: ["flat", "percent"] },
      // Add more reward types as needed
    },
    scope: {
      type: String,
      enum: ["order", "product", "delivery"],
      default: "order",
    },
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
