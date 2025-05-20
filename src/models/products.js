import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: String, required: true }, // e.g., "1L", "500g"
  stock: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  tags: [String],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  // subcategory: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "Subcategory",
  //   required: true,
  // },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seller",
    required: true,
  },
});

const Product = mongoose.model("Product", productSchema);
export default Product;
