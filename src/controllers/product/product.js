import mongoose from "mongoose";
import FeaturedSection from "../../models/featuredSection.js";
import Product from "../../models/products.js";

export const getProductsBySubcategoryId = async (req, reply) => {
  const { subcategoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(subcategoryId)) {
    return reply.status(400).send({ message: "Invalid Subcategory ID format." });
  }

  try {
    const products = await Product.find({ subcategory: subcategoryId }).exec();

    if (products.length === 0) {
      return reply
        .status(404)
        .send({ message: "No products found for this subcategory." });
    }

    return reply.send(products);
  } catch (error) {
    console.error("Error in getProductsBySubcategoryId:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getProductsByCategoryId = async (req, reply) => {
  const { categoryId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return reply.status(400).send({ message: "Invalid Category ID format." });
  }

  try {
    const products = await Product.find({ category: categoryId })
      .select("-category") // Consider if you still want to exclude category
      .exec();

    if (products.length === 0) {
      return reply
        .status(404)
        .send({ message: "No products found for this category." });
    }
    return reply.send(products);
  } catch (error) {
    console.error("Error in getProductsByCategoryId:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const searchProducts = async (req, reply) => {
  const { q, limit: queryLimit, relatedLimit: queryRelatedLimit } = req.query;

  if (!q) {
    return reply.status(400).send({ message: "Search query is required." });
  }

  const limit = parseInt(queryLimit, 10) || 20;
  const relatedLimit = parseInt(queryRelatedLimit, 10) || 5;

  try {
    const regex = new RegExp(q, "i");

    const matchedProducts = await Product.find({
      $or: [
        { name: regex },
        { desc: regex }, // Assuming 'desc' is the field for description
        // { brand: regex }, // Add if you have a brand field
        { tags: regex },
      ],
    }).limit(limit);

    let relatedProducts = [];
    if (matchedProducts.length > 0) {
      const categoryId = matchedProducts[0].category; // Assumes product always has a category
      relatedProducts = await Product.find({
        category: categoryId,
        _id: { $nin: matchedProducts.map((p) => p._id) },
      })
        .limit(relatedLimit)
        .select("-category"); // Consider if you want to exclude category
    }

    return reply.send({
      results: matchedProducts,
      related: relatedProducts,
    });
  } catch (error) {
    console.error("Error in searchProducts:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getProductById = async (req, reply) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return reply.status(400).send({ message: "Invalid Product ID format." });
  }
  // The additional check for !productId is slightly redundant if isValid handles null/undefined,
  // but kept for explicit clarity.
  if (!productId) {
    return reply.status(400).send({ message: "Product ID is required" });
  }

  try {
    const product = await Product.findById(productId);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }
    return reply.send({ product }); // Consider returning only product, not {product: product}
  } catch (error) {
    console.error("Error in getProductById:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getSuggestedProducts = async (req, reply) => {
  try {
    // This logic might need refinement based on how suggestions are determined.
    // For now, it fetches products with tags.
    const products = await Product.find({
      tags: { $exists: true, $not: { $size: 0 } },
    }).limit(10); // Added a limit as an example

    return reply.send(products);
  } catch (error) { // Changed err to error for consistency
    console.error("Error in getSuggestedProducts:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};

export const getFeaturedSections = async (req, reply) => {
  try {
    const sections = await FeaturedSection.find()
      .populate("products")
      .sort({ createdAt: -1 });

    return reply.send({ sections }); // Consider returning only sections, not {sections: sections}
  } catch (error) { // Changed err to error for consistency
    console.error("Error in getFeaturedSections:", error);
    return reply.status(500).send({ message: "An internal error occurred. Please try again later." });
  }
};
