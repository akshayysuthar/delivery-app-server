import mongoose from "mongoose";

const deliveryFeesSlabSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    minCartValue: { type: Number, required: true, min: 0 },
    charges: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const slotSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Time should be in HH:MM format",
      },
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Time should be in HH:MM format",
      },
    },
    orderLimit: { type: Number, required: true, min: 0 },
    // slotTime: { type: String, required: true },
    type: { type: String, enum: ["Regular", "Express"], required: true },
  },
  { _id: false }
);

const slotFeeSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    fee: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ServiceAreaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pinCode: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return /^\d{6}$/.test(v);
        },
        message: "Pincode must be 6 digits",
      },
    },
    areas: [
      {
        type: String,
        required: true,
      },
    ],
    deliveryCharges: {
      type: Number,
      default: 30,
      min: 0,
    },
    deliveryFeesSlab: [deliveryFeesSlabSchema],
    slots: [slotSchema],
    branches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
      },
    ],
    isActive: { type: Boolean, default: true },
    cutoffBufferMins: {
      type: Number,
      default: 120,
      min: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // slotFees: [slotFeeSchema],
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
ServiceAreaSchema.index({ pinCode: 1 });
ServiceAreaSchema.index({ branches: 1 });
ServiceAreaSchema.index({ isActive: 1 });

const ServiceArea = mongoose.model("ServiceArea", ServiceAreaSchema);

export default ServiceArea;
