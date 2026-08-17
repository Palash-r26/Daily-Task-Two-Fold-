import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import cookieParser from "cookie-parser";

const app: Express = express();

// 1. Helmet HTTP Security Headers (prevents clickjacking, MIME sniffing, XSS, etc.)
app.use(
  helmet({
    contentSecurityPolicy: false, // Allowed for frontend asset serving
    crossOriginEmbedderPolicy: false,
  }),
);

// 2. Logging Middleware
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// 3. CORS & Cookie Parser
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

// 4. Request Body Size Limits (protects against large payload DoS attacks)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 5. Rate Limiting: General API Limiter (200 requests per 15 minutes per IP)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again after 15 minutes." },
});

// 6. Rate Limiting: Auth Limiter for sensitive endpoints (15 requests per 15 minutes per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again after 15 minutes." },
});

// Apply rate limiters
app.use("/api/login", authLimiter);
app.use("/api/signup", authLimiter);
app.use("/api/reset-password", authLimiter);
app.use("/api", generalApiLimiter);

// 7. Security Caching Control for API Data (prevents caching sensitive messages/tasks/sessions)
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// 8. API Router
app.use("/api", router);

export default app;
