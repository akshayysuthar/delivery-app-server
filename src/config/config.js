// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

import fastifySession from "@fastify/session";
import ConnectMongoDBSession from "connect-mongodb-session";
import "dotenv/config.js";
import { Admin } from "../models/user.js";
// import bcrypt from "bcrypt"; // Uncomment if using hashed passwords

export const PORT = 3000;
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD;

const MongoDBStore = ConnectMongoDBSession(fastifySession);

export const sessionStore = new MongoDBStore({
  uri: process.env.MONGO_URL,
  collection: "sessions",
});

sessionStore.on("error", (error) => {
  console.log("session store error", error);
});

export const authenticate = async (email, password) => {
  // Hardcoded admin for first time login
  if (email === "akshaysuthar05@gmail.com" && password === "Akshay@123") {
    return Promise.resolve({ email, role: "superadmin" });
  }

  // Check in database for admin user
  if (email && password) {
    const user = await Admin.findOne({ email });
    if (!user) {
      return null;
    }
    // If using hashed passwords, use bcrypt:
    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) return null;

    // If storing plain passwords (not recommended):
    if (user.password !== password) {
      return null;
    }
    // Return user info (add more fields as needed)
    return Promise.resolve({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
  }
  return null;
};
