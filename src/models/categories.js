import mongoose from "mongoose";

// Image version schema
const imageVersionSchema = new mongoose.Schema(
  {
    image_type: String,
    icon_url: String,
    image_width: Number,
    image_height: Number,
    image_url: String,
    app_version: String,
    id: { type: Number, default: 0 },
  },
  { _id: false }
);

// Category schema
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  icon_url: String,
  banner_url: String,
  sort_order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  image_versions: [imageVersionSchema],
  group: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add indexes for better query performance
categorySchema.index({ name: 1 });
categorySchema.index({ sort_order: 1 });

// Pre-save middleware to update timestamps
categorySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Category = mongoose.model("Category", categorySchema);
export default Category;

// v1
// import mongoose from "mongoose";

// const subCategorySchema = new mongoose.Schema({
//   name: String,
//   image: String,
// });

// const categorySchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   image: { type: String, required: true },
//   subcategories: [subCategorySchema],
// });

// const Category = mongoose.model("Category", categorySchema);

// export default Category;
