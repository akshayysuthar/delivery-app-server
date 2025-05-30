import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  mrp: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: String, required: true }, // e.g., "1L", "500g"
  stock: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  sku: { type: String, unique: true }, // Unique identifier for variant
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  desc: { type: String },
  image: { type: String, required: true },
  additionalImages: [String], // Array of additional product images
  variants: [variantSchema],
  tags: [String],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subcategory",
    required: true,
  },
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
  slug: { type: String, unique: true }, // URL-friendly version of product name
  status: {
    type: String,
    enum: ["draft", "published", "archived"],
    default: "draft",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add indexes for better query performance
productSchema.index({ name: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ "variants.sku": 1 });

// Add pre-save middleware to update the updatedAt field
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;

// v1

// import mongoose from "mongoose";

// const productSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   desc: { type: String },
//   image: { type: String, required: true },
//   mrp: { type: Number, required: true },
//   price: { type: Number, required: true },
//   quantity: { type: String, required: true }, // e.g., "1L", "500g"
//   stock: { type: Number, default: 0 },
//   available: { type: Boolean, default: true },
//   tags: [String],
//   category: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Category",
//     required: true,
//   },
//   // subcategory: {
//   //   type: mongoose.Schema.Types.ObjectId,
//   //   ref: "Subcategory",
//   //   required: true,
//   // },
//   branch: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Branch",
//     required: true,
//   },
//   seller: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Seller",
//     required: true,
//   },
// });

// const Product = mongoose.model("Product", productSchema);
// export default Product;
