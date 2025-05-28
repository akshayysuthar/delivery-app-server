// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import {
  getAllCategories,
  getSubcategoriesByCategoryId,
} from "../controllers/product/categories.js";
import {
  getFeaturedSections,
  getProductById,
  getProductsByCategoryId,
  getProductsBySubcategoryId,
  getSuggestedProducts,
  searchProducts,
} from "../controllers/product/porduct.js";

export const categoryRoutes = async (fastify, options) => {
  fastify.get("/categories", getAllCategories);
  fastify.get("/subcategories/:categoryId", getSubcategoriesByCategoryId);
};
export const productRoutes = async (fastify, options) => {
  fastify.get("/products/:categoryId", getProductsByCategoryId);
  fastify.get(
    "/products/subcategory/:subcategoryId",
    getProductsBySubcategoryId
  );
  fastify.get("/search", searchProducts);
  fastify.get("/product/id/:productId", getProductById); // <-- Add this line
  fastify.get("/products/suggestions", getSuggestedProducts);
  fastify.get("/products/featured-sections", getFeaturedSections);
};
