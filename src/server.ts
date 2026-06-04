import "dotenv/config";
import { prisma } from "./config/prisma.js";
import { app } from "./app.js";

const PORT = process.env["PORT"] || 5001;

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("[Server] Shutting down, disconnecting database...");
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
});
