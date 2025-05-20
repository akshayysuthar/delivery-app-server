// https://www.youtube.com/watch?v=ojBfRGvdci8&list=WL&index=5&t=3638s
// linking the all routes in app.js

import "dotenv/config";
import { connectDB } from "./src/config/connect.js"; // <-- ADD ".js" here
import fastify from "fastify";
import { PORT } from "./src/config/config.js"; // (make sure config also has .js)
// import fastifySocketIO from "fastify-socket.io";
import { registerRoutes } from "./src/routes/index.js";
import { admin, buildAdminRouter } from "./src/config/setup.js";

const start = async () => {
  await connectDB(process.env.MONGO_URL);
  const app = fastify();

  // app.register(fastifySocketIO, {
  //   cors: {
  //     origin: "*",
  //   },
  //   pingInterval: 10000,
  //   pingTimeout: 5000,
  //   transports: ["websocket"],
  // });

  await registerRoutes(app);
  await buildAdminRouter(app);

  app.listen({ port: PORT, host: "0.0.0.0" }, (err, addr) => {
    if (err) {
      console.log(err);
    } else {
      console.log(
        `Grocery App Server running on http://localhost:${PORT}${admin.options.rootPath}`
      );
    }
  });

  // app.ready().then(() => {
  //   app.io.on("connection", (socket) => {
  //     console.log("User Connected ");
  //     socket.on("joinRoom", (orderId) => {
  //       socket.join(orderId);
  //       console.log(`User Joined room ${orderId}`);
  //     });
  //     socket.on("disconnect", () => {
  //       console.log("user disconnected");
  //     });
  //   });
  // });
};

start();
