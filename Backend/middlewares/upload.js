import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";

const baseUploadDir = process.env.UPLOAD_BASE_DIR
  ? path.resolve(process.env.UPLOAD_BASE_DIR)
  : process.env.NODE_ENV === "production"
    ? path.join(os.tmpdir(), "veda-uploads")
    : path.resolve("uploads");

const UPLOAD_DIR = path.join(baseUploadDir, "diagnosis");
const REPORTS_DIR = path.join(baseUploadDir, "reports");

// Ensure upload directories exist at startup
[UPLOAD_DIR, REPORTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `report-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only images (JPEG, PNG, WEBP) and PDF files are allowed"),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5, // max 5 files per upload
  },
});

// ─── Multer error wrapper (shared) ──────────────────────────────────────────
const wrapUpload = (multerFn) => (req, res, next) => {
  multerFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// ─── Diagnosis file upload (uploads/diagnosis/) ───────────────────────────────
export const uploadDiagnosisFiles = wrapUpload(upload.array("reports", 5));

// ─── Case/AI analysis file upload (uploads/reports/) ─────────────────────────
const reportsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, REPORTS_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `report-${uniqueSuffix}${ext}`);
  },
});

const reportsUpload = multer({
  storage: reportsStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 5,
  },
});

export const uploadReportFiles = wrapUpload(reportsUpload.array("reports", 5));
