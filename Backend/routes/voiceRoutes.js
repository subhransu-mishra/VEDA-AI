import express from "express";
import { protectPatient } from "../middlewares/authMiddleware.js";
import { parseVoiceInput } from "../controllers/Voice/voiceController.js";

const router = express.Router();

// POST /api/voice/parse
// Auth required (patient JWT). Accepts JSON body: { text: string }
router.post("/parse", protectPatient, parseVoiceInput);

export default router;
