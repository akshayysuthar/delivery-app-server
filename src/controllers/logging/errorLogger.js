import fs from "fs";
import path from "path";

export const logError = async (request, reply) => {
  const {
    error,
    context = "",
    timestamp = new Date().toISOString(),
    platform = "unknown",
  } = request.body;

  const logEntry = `[${timestamp}] [${platform}] [${context}] ${error}\n`;

  // Optionally log to console
  request.log.error(logEntry);
  // console.log(logEntry);

  // Save to a local file
  const logPath = path.resolve("logs", "error_logs.txt");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, logEntry);

  return reply.send({ success: true });
};
