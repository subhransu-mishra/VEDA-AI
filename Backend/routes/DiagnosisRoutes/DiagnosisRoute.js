import express from "express";
import { protectPatient } from "../../middlewares/authMiddleware.js";
import { uploadDiagnosisFiles } from "../../middlewares/upload.js";
import {
  submitDiagnosis,
  getPatientCases,
  getCaseById,
} from "../../controllers/Diagnosis/diagnosisController.js";

const router = express.Router();

// POST   /api/diagnosis/submit       – submit a new diagnosis case with optional file uploads
router.post("/submit", protectPatient, uploadDiagnosisFiles, submitDiagnosis);

// GET    /api/diagnosis/my-cases     – list all cases for the authenticated patient
router.get("/my-cases", protectPatient, getPatientCases);

// GET    /api/diagnosis/case/:caseId – get a single case by its caseId
router.get("/case/:caseId", protectPatient, getCaseById);

export default router;
