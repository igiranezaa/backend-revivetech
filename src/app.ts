import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { prisma } from "./config/prisma.js";
import { getOpenApiSpec, swaggerHtml } from "./config/openapi.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { rateLimiter } from "./middlewares/rateLimiter.js";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);

  app.use(cors());
  app.use(express.json());
  app.use(rateLimiter());

  app.use("/api", routes);

  app.get("/api-docs.json", (req: Request, res: Response) => {
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
    const protocol = forwardedProto || req.protocol;
    const host = forwardedHost || req.get("host") || "localhost:5001";
    const baseUrl = `${protocol}://${host}`;

    res.status(200).json(getOpenApiSpec(baseUrl));
  });

  app.get("/api-docs", (_req: Request, res: Response) => {
    res.type("html").send(swaggerHtml);
  });

  app.get("/health", async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: "UP",
        timestamp: new Date(),
        services: {
          database: "CONNECTED",
          api: "HEALTHY",
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: "DOWN",
        timestamp: new Date(),
        services: {
          database: "DISCONNECTED",
          api: "UNHEALTHY",
        },
        error: error.message,
      });
    }
  });

  app.get("/", (_req: Request, res: Response) => {
    res.status(200).send("Welcome to the Secondhand Device Refurbishment & Financing Platform API");
  });

  app.use(errorHandler);

  return app;
};

export const app = createApp();
