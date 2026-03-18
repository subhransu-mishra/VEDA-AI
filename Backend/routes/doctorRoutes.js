import express from "express";
import { protectPatient } from "../middlewares/authMiddleware.js";
import { getMatchedDoctors } from "../controllers/doctorController.js";

const router = express.Router();

router.get("/match/:caseId", protectPatient, getMatchedDoctors);

export default router;
