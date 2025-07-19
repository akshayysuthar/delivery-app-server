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
  status: {
    type: String,
    enum: [
      "prewave",
      "confirmed",
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
    method: {
      type: String,
      enum: ["COD", "Online", "upi", "cash"],
      default: "COD",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "payment_collected", "failed"],
      default: "pending",
    },
  },

  totalPrice: { type: Number, required: true },
  statusTimestamps: {
    confirmedAt: Date,
    packedAt: Date,
    assignedAt: Date,
    arrivingAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  deliveryCharge: { type: Number },
  handlingCharge: { type: Number },
  savings: { type: Number },

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
     branch: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Branch",
          required: true,
        },
      ],
      name: String,
      image: String,
      count: { type: Number, required: true },
      price: { type: Number, required: true },
      itemTotal: { type: Number, required: true },
      unit: { type: String }, // added this for porduct unit like 1 kg, 500g, 12 items
      cancellationReason: { type: String }, // 👈 Add this

      status: {
        type: String,
        enum: [
          "prewave",
          "pending",
          "confirmed",
          "packing",
          "packed",
          "ready",
          "cancelled", // Add this
        ],
        default: "pending",
      },
    },
  ],

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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // orderType: {
  //   type: String,
  //   enum: ["Regular ", "Express"],
  //   default: "Regular",
  // },
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
