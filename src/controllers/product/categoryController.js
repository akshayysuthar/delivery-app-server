// controllers/categoryController.js

import Category from "../../models/Category.js";
import SubCategory from "../../models/SubCategory.js";

export const getAllCategoriesWithSubcategories = async (req, reply) => {
  try {
    const categories = await Category.find();

    const categoriesWithSub = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await SubCategory.find({
          category: category._id,
        });

        return {
          ...category._doc,
          subcategories,
        };
      })
    );

    return reply.send(categoriesWithSub);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "An error occurred", error });
  }
};
