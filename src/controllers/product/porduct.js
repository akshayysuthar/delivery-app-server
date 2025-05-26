import Product from "../../models/products.js";

export const getProductsBySubcategoryId = async (req, reply) => {
  const { subcategoryId } = req.params;

  try {
    const products = await Product.find({ subcategory: subcategoryId }).exec();

    if (products.length === 0) {
      return reply
        .status(404)
        .send({ message: "No products found for this subcategory." });
    }

    return reply.send(products);
  } catch (error) {
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

export const searchProducts = async (req, reply) => {
  const { q } = req.query;

  if (!q) {
    return reply.status(400).send({ message: "Search query is required." });
  }

  try {
    // Case-insensitive partial match on name, description, or brand
    const regex = new RegExp(q, "i");

    const matchedProducts = await Product.find({
      $or: [
        { name: regex },
        { description: regex },
        { brand: regex },
        { tags: regex }, // optional: search in tags too
      ],
    }).limit(20);

    // Related products from same category
    let relatedProducts = [];
    if (matchedProducts.length > 0) {
      const categoryId = matchedProducts[0].category;
      relatedProducts = await Product.find({
        category: categoryId,
        _id: { $nin: matchedProducts.map((p) => p._id) },
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
