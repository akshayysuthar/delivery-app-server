import jwt from "jsonwebtoken";

export const verifyToken = async (req, reply) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ message: "access token required" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    return true;
  } catch (error) {
    return reply.status(403).send({ message: "Invlid or expired token" });
  }
};

export async function authenticate(req, reply) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = decoded; // This will contain userId and role
  } catch (err) {
    return reply.status(401).send({ message: "Invalid or expired token" });
  }
}
