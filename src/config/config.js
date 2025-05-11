import fastifySession from "@fastify/session";
import ConnectMongoDBSession from "connect-mongodb-session";
import "dotenv/config.js";

import { Admin } from "../models/user.js";

export const PORT = process.env.PORT || 3000;
export const COOKIE_PASSWORD = process.env.COOKIE_PASSWORD;

const MongoDBStore = ConnectMongoDBSession(fastifySession);

// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s

export const sessionStore = new MongoDBStore({
  uri: process.env.MONGO_URL,
  collection: "sessions",
});

sessionStore.on("error", (error) => {
  console.log("session store error", error);
});

export const authenticate = async (email, password) => {
  // for first time admin creation and login
  if (email && password) {
    if (email == "akshaysuthar05@gmail.com" && password === "Akshay@123") {
      return Promise.resolve({ email: email, password: password });
    } else {
      return null;
    }
  }

  // uncomment this when created admin manually
  if (email & password) {
    const user = await Admin.findOne({ email });
    if (!user) {
      return null;
    }
    if (user.password === password) {
      return Promise.resolve({ email: email, password: password });
    } else {
      return null;
    }
  }
  return null;
};
