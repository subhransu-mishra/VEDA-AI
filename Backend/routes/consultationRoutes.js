import express from "express";
import {
  protectDoctor,
  protectPatient,
} from "../middlewares/authMiddleware.js";
import {
  claimConsultationByDoctor,
  createConsultation,
  getAllDoctorCases,
  getAssignableDoctors,
  getDoctorCaseByCaseId,
  getDoctorConsultationRequests,
  getConsultationById,
  reassignConsultationByDoctor,
  submitDoctorCaseResponse,
  updateConsultationStatusByDoctor,
} from "../controllers/consultationController.js";

const router = express.Router();

router.post("/create", protectPatient, createConsultation);
router.get("/doctor/requests", protectDoctor, getDoctorConsultationRequests);
router.get("/doctor/all-cases", protectDoctor, getAllDoctorCases);
router.get("/doctor/case/:caseId", protectDoctor, getDoctorCaseByCaseId);
router.get("/doctor/assignees", protectDoctor, getAssignableDoctors);
router.patch("/doctor/:id/claim", protectDoctor, claimConsultationByDoctor);
router.patch(
  "/doctor/:id/reassign",
  protectDoctor,
  reassignConsultationByDoctor,
);
router.patch(
  "/doctor/:id/status",
  protectDoctor,
  updateConsultationStatusByDoctor,
);
router.patch("/doctor/:id/response", protectDoctor, submitDoctorCaseResponse);
router.get("/:id", protectPatient, getConsultationById);

export default router;
