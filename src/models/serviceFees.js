import mongoose from "mongoose";
const ServiceFeesSchema = new mongoose.Schema({
  Name: String,
  Type: String,
  FeesAmt: Number,
  MinCartAmt: Number,
});

const ServiceFees = mongoose.model("ServiceFees", ServiceFeesSchema);

export default ServiceFees;
