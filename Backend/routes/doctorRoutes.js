import express from "express";
import {
  protectAdmin,
  protectDoctor,
  protectPatient,
} from "../middlewares/authMiddleware.js";
import { getMatchedDoctors } from "../controllers/doctorController.js";
import { uploadDoctorVerificationDocuments } from "../middlewares/verificationUpload.js";
import {
  getMyDoctorVerification,
  listDoctorVerificationApplications,
  reviewDoctorVerification,
  submitDoctorVerification,
} from "../controllers/verification/doctorVerification.js";

const router = express.Router();

router.get("/match/:caseId", protectPatient, getMatchedDoctors);
router.post(
  "/verification",
  protectDoctor,
  uploadDoctorVerificationDocuments,
  submitDoctorVerification,
);
router.get("/verification/me", protectDoctor, getMyDoctorVerification);

router.get(
  "/verification/admin/applications",
  protectAdmin,
  listDoctorVerificationApplications,
);
router.patch(
  "/verification/admin/:doctorId/review",
  protectAdmin,
  reviewDoctorVerification,
);

export default router;
