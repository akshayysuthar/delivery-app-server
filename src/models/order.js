import mongoose from "mongoose";
import Counter from "./counter.js";

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
  },
  deliveryPartner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryPartner",
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
      },
      name: String,
      image: String,
      count: { type: Number, required: true },
      price: { type: Number, required: true },
      itemTotal: { type: Number, required: true },
      status: {
        type: String,
        enum: ["prewave", "pending", "packing", "packed", "ready"],
        default: "pending",
      },
    },
  ],

  statusTimestamps: {
    confirmedAt: Date,
    packedAt: Date,
    arrivingAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  deliveryLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  deliveryAddress: {
    address: { type: String },
  },
  pickupLocations: [
    {
      branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
      },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, required: true },
    },
  ],

  slot: {
    id: String,
    label: String,
    startTime: String,
    endTime: String,
    date: String,
  },
  deliveryPersonLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  discount: {
    type: { type: String },
    amt: { type: String },
  },
  // orderType: {
  //   type: String,
  //   enum: ["Regular ", "Express"],
  //   default: "Regular",
  // },
  status: {
    type: String,
    enum: [
      "prewave",
      "pending",
      "packing",
      "packed",
      "ready",
      "assigned",
      "arriving",
      "delivered",
      "cancelled",
    ],
    default: "pending",
  },
  payment: {
    method: { type: String, enum: ["COD", "Online", "Cash"], default: "COD" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },

  deliveryCharge: { type: Number },
  handlingCharge: { type: Number },
  savings: { type: Number },
  totalPrice: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

async function getNextSequenceValue(sequenceName) {
  const sequenceDocument = await Counter.findOneAndUpdate(
    { name: sequenceName },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );
  return sequenceDocument.sequence_value;
}

orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const sequenceValue = await getNextSequenceValue("orderId");
    this.orderId = `ORD${sequenceValue.toString().padStart(5, "0")}`;
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

export default Order;
