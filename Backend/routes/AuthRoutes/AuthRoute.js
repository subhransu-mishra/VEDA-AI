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

export default router;
