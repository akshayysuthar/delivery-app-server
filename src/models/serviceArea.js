import mongoose from "mongoose";
const ServiceAreaSchema = new mongoose.Schema({
  name: { type: String },
  pinCode: { type: Number },
  Areas: [String],
  deliveryCharges: { type: Number, default: 30 },
  deliveryFeesSlab: [
    {
      Name: String,
      minCartValue: Number,
      charges: Number,
    },
  ],

  Slots: [
    {
      label: String,
      startTime: String,
      endTime: String,
      orderLimit: Number,
      slotTime: String,
      type: { type: String, enum: ["Regular", "Express"] },
    },
  ],

  Branch: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
  ],

  isActive: { type: Boolean, default: true },
  cutoffBufferMins: { type: Number, default: 120 },
  freeDeliveryAbove: Number,
  minimumOrderAmount: Number,
  slotFees: [
    {
      type: String,
      fee: Number,
    },
  ],
});

const ServiceArea = mongoose.model("ServiceArea", ServiceAreaSchema);

export default ServiceArea;
