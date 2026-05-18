// Trigger nodemon restart
import "dotenv/config";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import compression from "compression";
import morgan from "morgan";
import type { NextFunction } from "express";
import v1Router from "./routes/v1/index.js";
import { deprecateV1 } from "./middlewares/deprecation.middleware.js";
import { connectDB } from "./config/prisma.js";
import { setupSwagger } from "./config/swagger.js";
import { generalLimiter, strictLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();
const port = Number(process.env["PORT"]) || 3000;

// Trust proxy — required for rate limiting and correct IP detection on Render
app.set("trust proxy", 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins: (string | RegExp)[] = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://airbnb-front-end.vercel.app", 
  /\.vercel\.app$/,  
];

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(process.env["NODE_ENV"] === "production" ? morgan("combined") : morgan("dev"));

// Apply compression middleware
app.use(compression());

// Parse JSON bodies
app.use(express.json());

// Apply general rate limiter to all routes
app.use(generalLimiter);

// Setup Swagger documentation
setupSwagger(app);

app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// Apply strict rate limiter to all POST routes globally
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") {
    return strictLimiter(req, res, next);
  }
  next();
});

// Mount v1 API with deprecation headers
app.use("/api/v1", deprecateV1, v1Router);

// Redirect unversioned paths to v1 for backwards compatibility
app.use(
  ["/auth", "/users", "/listings", "/bookings", "/reviews", "/upload"],
  (req: Request, res: Response) => {
    const target = `/api/v1${req.baseUrl}${req.url}`;
    res.redirect(301, target);
  }
);

// Root endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Welcome to the Airbnb API",
    version: "1.0.0",
    status: "active",
    documentation: "/api-docs",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      listings: "/api/v1/listings",
      bookings: "/api/v1/bookings",
      reviews: "/api/v1/reviews",
    },
    health: "/health",
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use(errorHandler);

// Connect to database
connectDB().catch((error: unknown) => {
  console.error("Failed to connect to database", error);
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});

export default app;