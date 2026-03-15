import express from "express";
import {
  doctorSignup,
  doctorLogin,
  patientSignup,
  patientLogin,
} from "../../controllers/Auth/AuthController.js";

const router = express.Router();

router.post("/doctor/signup", doctorSignup);
router.post("/doctor/login", doctorLogin);
router.post("/patient/signup", patientSignup);
router.post("/patient/login", patientLogin);

export default router;
