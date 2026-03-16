import express from "express";
import { protectPatient } from "../../middlewares/authMiddleware.js";
import { uploadReportFiles } from "../../middlewares/upload.js";
import { analyzeCase } from "../../controllers/Case/caseController.js";

const router = express.Router();

// POST /api/case/analyze
// Auth required (patient JWT). Accepts multipart/form-data:
//   - patient fields in body (age, gender, symptoms, ...)
//   - optional uploaded reports under field name "reports" (PDF / images)
router.post("/analyze", protectPatient, uploadReportFiles, analyzeCase);

export default router;
