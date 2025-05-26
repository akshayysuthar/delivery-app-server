import mongoose from "mongoose";

const ServiceFeesSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["delivery", "packaging", "handling", "service", "other"],
    },
    amount: { type: Number, required: true, min: 0 },
    minCartAmount: { type: Number, default: 0, min: 0 },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    applicableBranches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
      },
    ],
  },
  { timestamps: true }
);

ServiceFeesSchema.index({ type: 1 });
ServiceFeesSchema.index({ isActive: 1 });

const ServiceFees = mongoose.model("ServiceFees", ServiceFeesSchema);

export default ServiceFees;
