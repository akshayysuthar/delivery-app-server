import mongoose from "mongoose";

const subcategorySchema = new mongoose.Schema({
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    // required: true
  },
  name: { type: String, required: true },
  description: String,
  icon_url: String,
  sort_order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  image_versions: [
    {
      image_type: String,
      icon_url: String,
      image_width: Number,
      image_height: Number,
      image_url: String,
      app_version: String,
      id: { type: Number, default: 0 }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes
subcategorySchema.index({ category_id: 1 });
subcategorySchema.index({ name: 1 });
subcategorySchema.index({ sort_order: 1 });

// Add cascade delete functionality
subcategorySchema.pre('remove', function(next) {
  this.model('Category').updateOne(
    { _id: this.category_id },
    { $pull: { subcategories: this._id } },
    next
  );
});

const Subcategory = mongoose.model("Subcategory", subcategorySchema);
export default Subcategory;