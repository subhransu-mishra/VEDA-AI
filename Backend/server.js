import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./config/db.js";
import authRoutes from "./routes/AuthRoutes/AuthRoute.js";
import diagnosisRoutes from "./routes/DiagnosisRoutes/DiagnosisRoute.js";
import caseRoutes from "./routes/CaseRoutes/CaseRoute.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import voiceRoutes from "./routes/voiceRoutes.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const normalizeOrigin = (origin) => origin?.trim().replace(/\/$/, "");

const globToRegex = (glob) => {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
};

const configuredOrigins = [
  ...(process.env.CORS_ORIGINS || "").split(","),
  process.env.FRONTEND_URL || "",
]
  .map(normalizeOrigin)
  .filter(Boolean);

const configuredOriginGlobs = (process.env.CORS_ORIGIN_GLOBS || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

const configuredOriginRegexes = configuredOriginGlobs
  .map((glob) => {
    try {
      return globToRegex(glob);
    } catch (_error) {
      return null;
    }
  })
  .filter(Boolean);

const allowAllOrigins = configuredOrigins.includes("*");

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests and tools like Postman (no browser origin).
    if (!origin || allowAllOrigins) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const isExactAllowed = configuredOrigins.includes(normalizedOrigin);
    const isPatternAllowed = configuredOriginRegexes.some((regex) =>
      regex.test(normalizedOrigin),
    );
    const isAllowed = isExactAllowed || isPatternAllowed;

    if (isAllowed) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 200,
};

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
app.use("/api/case", caseRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/consultation", consultationRoutes);
app.use("/api/voice", voiceRoutes);

app.get("/", (req, res) => {
  res.send("Running Well");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || "development",
    service: "veda-backend",
  });
});

app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS blocked for this origin",
    });
  }

  return next(err);
});

const startServer = async () => {
  try {
    await connectDb();

    app.listen(PORT, () => {
      console.log("Running on PORT " + PORT);
      console.log(
        "Allowed CORS origins:",
        configuredOrigins.length ? configuredOrigins : ["*"],
      );
      if (configuredOriginGlobs.length) {
        console.log("Allowed CORS origin globs:", configuredOriginGlobs);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
