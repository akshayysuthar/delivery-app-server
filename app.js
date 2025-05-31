import "dotenv/config";
import { connectDB } from "./src/config/connect.js"; // <-- ADD ".js" here
import fastify from "fastify";
import { PORT } from "./src/config/config.js"; // (make sure config also has .js)

import { registerRoutes } from "./src/routes/index.js";
import { admin, buildAdminRouter } from "./src/config/setup.js";

const start = async () => {
  await connectDB(process.env.MONGO_URL);

  const app = fastify();

  // Register AdminJS router ONCE
  await buildAdminRouter(app);

  // Register other routes
  await registerRoutes(app);

  app.listen({ port: PORT, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
      console.log(err);
    } else {
      console.log(
        `Grocery App Server running on http://localhost:${PORT}${admin.options.rootPath}`
      );
    }
  });
};

start();
