import FeaturedSection from "../../models/featuredSection.js";
import Product from "../../models/products.js";
import mongoose from "mongoose";

// GET /products/:subcategoryId?branchId=...

export const getProductsBySubcategoryId = async (req, reply) => {
  const { subcategoryId } = req.params;
  const { branchIds } = req.query;

  if (!branchIds) {
    return reply.status(400).send({ message: "branchIds is required." });
  }

  // Convert string IDs to ObjectId
  const branchIdArray = branchIds
    .split(",")
    .map((id) => new mongoose.Types.ObjectId(id.trim()));

  try {
    const products = await Product.find({
      subcategory: new mongoose.Types.ObjectId(subcategoryId),
      branches: { $in: branchIdArray },
      // active: true,
    }).exec();

    if (!products || products.length === 0) {
      return reply.status(404).send({
        message:
          "No products found for this subcategory in any of the specified branches.",
      });
    }

    console.log("Querying products for subcategory:", subcategoryId);
    console.log("Branch IDs:", branchIdArray);

    return reply.send(products);
  } catch (error) {
    console.error("Product fetch error:", error);
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const searchProducts = async (req, reply) => {
  const { q, branchId } = req.query;

  if (!q) {
    return reply.status(400).send({ message: "Search query is required." });
  }

  try {
    const regex = new RegExp(q, "i");

    const baseQuery = {
      $or: [
        { name: regex },
        { description: regex },
        { brand: regex },
        { tags: regex },
      ],
    };

    // If branch filtering is needed
    if (branchId) {
      baseQuery.branch = branchId; // assuming your Product schema has `branch`
    }

    const matchedProducts = await Product.find(baseQuery).limit(20);

    // Optional: fetch related products
    let relatedProducts = [];
    if (matchedProducts.length > 0) {
      const categoryId = matchedProducts[0].category;
      relatedProducts = await Product.find({
        category: categoryId,
        _id: { $nin: matchedProducts.map((p) => p._id) },
        ...(branchId && { branches: branchId }),
      })
        .limit(5)
        .select("-category");
    }

    return reply.send({
      results: matchedProducts,
      related: relatedProducts,
    });
  } catch (error) {
    console.error("Search error:", error);
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const getProductsByCategoryId = async (req, reply) => {
  const { categoryId } = req.params;

  try {
    const products = await Product.find({ category: categoryId })
      .select("-category")
      .exec();
    return reply.send(products);
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const getProductById = async (req, reply) => {
  try {
    const { productId } = req.params;
    if (!productId) {
      return reply.status(400).send({ message: "Product ID is required" });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return reply.status(404).send({ message: "Product not found" });
    }
    return reply.send({ product });
  } catch (error) {
    return reply
      .status(500)
      .send({ message: "Failed to fetch product", error: error.message });
  }
};

export const getSuggestedProducts = async (req, reply) => {
  try {
    const products = await Product.find({
      tags: { $exists: true, $not: { $size: 0 } },
    });

    return reply.send(products);
  } catch (err) {
    console.error("Error fetching suggested products:", err);
    return reply
      .status(500)
      .send({ message: "Failed to fetch products", error: err });
  }
};

export const getFeaturedSections = async (req, reply) => {
  try {
    const sections = await FeaturedSection.find()
      .populate("products") // populate product details
      .sort({ createdAt: -1 });

    return reply.send({ sections });
  } catch (err) {
    console.error("Failed to fetch featured sections", err);
    return reply
      .status(500)
      .send({ message: "Failed to fetch featured sections", error: err });
  }
};
