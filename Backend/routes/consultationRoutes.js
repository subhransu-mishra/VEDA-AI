import express from "express";
import {
  protectDoctor,
  protectPatient,
} from "../middlewares/authMiddleware.js";
import {
  createConsultation,
  getDoctorConsultationRequests,
  getConsultationById,
  updateConsultationStatusByDoctor,
} from "../controllers/consultationController.js";

const router = express.Router();

router.post("/create", protectPatient, createConsultation);
router.get("/doctor/requests", protectDoctor, getDoctorConsultationRequests);
router.patch(
  "/doctor/:id/status",
  protectDoctor,
  updateConsultationStatusByDoctor,
);
router.get("/:id", protectPatient, getConsultationById);

export default router;
