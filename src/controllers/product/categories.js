import Category from "../../models/categories.js";
import Subcategory from "../../models/subcatgories.js";

export const getAllCategories = async (req, reply) => {
  try {
    const categories = await Category.find();
    return reply.send(categories);
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", err });
  }
};

// export const getAllCategories = async (req, reply) => {
//   try {
//     const categories = await Category.find();

//     // Group categories by `group` field
//     const grouped = categories.reduce((acc, category) => {
//       const group = category.group || 'Other';
//       if (!acc[group]) acc[group] = [];
//       acc[group].push(category);
//       return acc;
//     }, {});

//     return reply.send(grouped);
//   } catch (err) {
//     return reply.status(500).send({ message: "An error occurred", err });
//   }
// };

export const getAllCategoriesWithSubcategories = async (req, reply) => {
  try {
    const categories = await Category.find().lean();
    const subcategories = await Subcategory.find().lean();

    // Attach subcategories to their parent category
    const categoriesWithSubs = categories.map((cat) => ({
      ...cat,
      subcategories: subcategories.filter(
        (sub) => String(sub.category) === String(cat._id)
      ),
    }));

    if (categoriesWithSubs.length === 0) {
      return reply.status(404).send({ message: "No categories found." });
    }

    return reply.send(categoriesWithSubs);
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};

export const getSubcategoriesByCategoryId = async (req, reply) => {
  const { categoryId } = req.params;
  try {
    const subcategories = await Subcategory.find({
      category_id: categoryId,
    }).lean();
    if (subcategories.length === 0) {
      return reply
        .status(404)
        .send({ message: "No subcategories found for this category." });
    }
    return reply.send(subcategories);
  } catch (error) {
    return reply.status(500).send({ message: "An error occurred", error });
  }
};
