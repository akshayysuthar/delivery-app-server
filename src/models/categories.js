import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema({
  name: String,
  image: String,
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  subcategories: [subCategorySchema],
});

const Category = mongoose.model("Category", categorySchema);

export default Category;
