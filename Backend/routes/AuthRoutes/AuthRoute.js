import express from "express";
import {
  adminLogin,
  doctorSignup,
  doctorLogin,
  patientSignup,
  patientLogin,
} from "../../controllers/Auth/AuthController.js";

const router = express.Router();

router.post("/doctor/signup", doctorSignup);
router.post("/doctor/login", doctorLogin);
router.post("/admin/login", adminLogin);
router.post("/patient/signup", patientSignup);
router.post("/patient/login", patientLogin);

export default router;
