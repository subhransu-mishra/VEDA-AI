import express from "express";
import { protectPatient } from "../middlewares/authMiddleware.js";
import {
  createConsultation,
  getConsultationById,
} from "../controllers/consultationController.js";

const router = express.Router();

router.post("/create", protectPatient, createConsultation);
router.get("/:id", protectPatient, getConsultationById);

export default router;
