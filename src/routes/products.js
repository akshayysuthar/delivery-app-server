// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import { getAllCategories } from "../controllers/product/categories.js";
import {
  getProductsByCategoryId,
  searchProducts,
} from "../controllers/product/porduct.js";

export const categoryRoutes = async (fastify, options) => {
  fastify.get("/categories", getAllCategories);
};
export const productRoutes = async (fastify, options) => {
  fastify.get("/products/:categoryId", getProductsByCategoryId);
  fastify.get("/search", searchProducts); // ✅ just "/search"
};
