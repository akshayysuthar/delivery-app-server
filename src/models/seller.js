import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Address: { type: String, required: true },
  Email: { type: String, required: true },
  Phone: { type: Number, required: true },
  Type: { type: String, required: true },
});

const Seller = mongoose.model("Seller", sellerSchema);

export default Seller;
