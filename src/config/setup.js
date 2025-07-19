import AdminJS, { ComponentLoader } from "adminjs";
import AdminJSFastify from "@adminjs/fastify";
import * as AdminJSMongoose from "@adminjs/mongoose";
import * as Models from "../models/index.js";
import { COOKIE_PASSWORD, authenticate, sessionStore } from "./config.js";
import { dark, light, noSidebar } from "@adminjs/themes";
import importExportFeature from "@adminjs/import-export";

const componentLoader = new ComponentLoader();

AdminJS.registerAdapter(AdminJSMongoose);
export const admin = new AdminJS({
  resources: [
    {
      resource: Models.Order,
      options: {
        filterProperties: [
          "createdAt", // Date filter (make sure your Order schema has timestamps)
          "customer", // Reference to customer
          "items.branch", // Reference to branch
          // add other filters as needed
        ],
        features: [importExportFeature({ componentLoader })],
        actions: {
          export: { isAccessible: true }, // Export enabled
        },
      },
    },
    { resource: Models.Customer },
    { resource: Models.Address },
    { resource: Models.DeliveryPartner },
    { resource: Models.Admin },
    { resource: Models.FeaturedSection },
    { resource: Models.CategorySection },
    // { resource: Models.Picker },
    // { resource: Models.BranchAdmin },
    { resource: Models.SellerUser },
    { resource: Models.Branch },
    { resource: Models.Product },
    { resource: Models.Category },
    { resource: Models.Subcategory },
    { resource: Models.Counter },
    { resource: Models.ServiceArea },
    { resource: Models.Slots },
    { resource: Models.ServiceFees },
    { resource: Models.Seller },
    { resource: Models.Offer },
    { resource: Models.Banner },
    // { resource: Models.VisualConfig },
    { resource: Models.CustomerSuggestion },
    // { resource: Models.CategorySection },
  ],
  branding: {
    companyName: "Delivery App ",
    withMadeWithLove: true,
  },
  defaultTheme: dark.id,
  availableThemes: [dark, light, noSidebar],
  rootPath: "/admin",
});

export const buildAdminRouter = async (app) => {
  await AdminJSFastify.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: COOKIE_PASSWORD,
      cookieName: "adminjs",
    },
    app,
    {
      store: sessionStore,
      saveUnintailsized: true,
      secret: COOKIE_PASSWORD,
      cookie: {
        httpOnly: process.env.NODE_ENV === "production",
        secure: process.env.NODE_ENV === "production",
      },
    }
  );
};
