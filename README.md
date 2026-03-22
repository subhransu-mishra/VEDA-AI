# VedaAI

VedaAI is a full-stack AI-assisted medical triage and consultation platform.

It helps patients describe symptoms privately, supports report uploads (PDF/image), generates structured AI triage insights, and connects patients to verified doctors for consultation and follow-up responses.

---

## Table of Contents

- [1. Project Objective](#1-project-objective)
- [2. Problem and Solution](#2-problem-and-solution)
- [3. High-Level Architecture](#3-high-level-architecture)
- [4. Core Workflows](#4-core-workflows)
- [5. Features](#5-features)
- [6. Tech Stack](#6-tech-stack)
- [7. Repository Structure](#7-repository-structure)
- [8. Backend API Reference](#8-backend-api-reference)
- [9. Data Models](#9-data-models)
- [10. Environment Variables](#10-environment-variables)
- [11. Local Development Setup](#11-local-development-setup)
- [12. Security and Access Control](#12-security-and-access-control)
- [13. Validation and Error Behavior](#13-validation-and-error-behavior)
- [14. Known Gaps and Current Limitations](#14-known-gaps-and-current-limitations)
- [15. Suggested Production Improvements](#15-suggested-production-improvements)
- [16. Contributing](#16-contributing)
- [17. License](#17-license)

---

## 1. Project Objective

VedaAI is designed to reduce friction between symptom onset and medical guidance.

Primary objective:

- Give patients a private, structured, and faster first step for health concerns.
- Convert unstructured patient input (typed symptoms, voice text, uploaded reports) into a usable clinical triage summary.
- Route patients to relevant doctors using specialist matching.
- Support doctors with case context and structured response generation.

---

## 2. Problem and Solution

### Problem

Many patients delay care because early conversations about health concerns are uncomfortable, unstructured, or hard to initiate. Patients also struggle to present complete medical context quickly.

### Solution in this codebase

VedaAI addresses this with:

- Guided symptom intake and voice parsing.
- OCR/text extraction from uploaded reports.
- AI triage analysis with urgency assessment and specialist recommendation.
- Doctor matching and consultation lifecycle management.
- Doctor verification workflow (admin-reviewed).
- Structured doctor response/report generation.

---

## 3. High-Level Architecture

### System Overview

- Frontend: React + Vite single-page app.
- Backend: Express API with JWT role-based protection.
- Database: MongoDB via Mongoose.
- AI: Anthropic Clude sonnet 4.6 , Google Gemini 2.5 pro and Qwen: Qwen3.5 for triage and structuring.
- Files:
  - Patient case uploads: local disk storage.
  - Doctor verification documents: Cloudinary upload.

### Backend request flow

1. Request enters Express route.
2. Role middleware validates JWT (`patient`, `doctor`, or `admin`).
3. Optional file middleware handles multipart uploads.
4. Controller validates payload and orchestrates domain logic.
5. Services run OCR/PDF extraction/AI analysis/matching.
6. Models persist or read data from MongoDB.
7. JSON response returned to client.

---

## 4. Core Workflows

## A) Patient Symptom Analysis and Triage

1. Patient logs in.
2. Patient submits symptom details and optional reports.
3. Backend extracts text from uploads:
   - PDF -> `pdf-parse`
   - Image -> `tesseract.js`
4. Backend builds a clinical triage prompt and calls Gemini.
5. AI response is normalized and persisted in `Case`.
6. Patient receives triage summary, urgency, likely conditions, and specialist guidance.

## B) Voice Input Parsing

1. Patient sends free-text voice transcript to `/api/voice/parse`.
2. Backend tries Gemini JSON extraction.
3. If AI parsing fails, fallback regex parser extracts partial fields.
4. Structured payload returned for pre-filling intake forms.

## C) Doctor Matching and Consultation Creation

1. Patient requests matched doctors for a case.
2. Backend reads AI primary specialist and finds verified doctors.
3. Doctors are ranked by weighted score.
4. Patient creates consultation with selected doctor (or auto-assign path).
5. Consultation record is created; case status moves forward.

## D) Doctor Verification

1. Doctor signs up.
2. Doctor submits verification details and 4 documents.
3. Files are uploaded to Cloudinary.
4. Admin reviews applications.
5. Admin approves/rejects with status update.
6. Only verified doctors are eligible for matching.

## E) Doctor Case Handling and Structured Response

1. Doctor sees assigned/pending cases.
2. Doctor claims or reassigns consultation.
3. Doctor submits clinical response (medication plan, tests, follow-up, severity).
4. Backend optionally structures response through Gemini into report JSON.
5. Consultation and case move to completed state.

---

## 5. Features

### Patient-facing

- Patient signup/login with JWT.
- Structured symptom intake.
- Voice text parsing into clinical fields.
- Upload reports/images for AI-assisted triage.
- Urgency and emergency signal generation.
- Specialist recommendation and matched doctor discovery.
- Consultation request creation.
- Consultation status visibility.

### Doctor-facing

- Doctor signup/login.
- Verification form with document upload.
- Consultation queue and case detail retrieval.
- Claim/reassign consultation.
- Submit doctor response.
- Generate structured report JSON from raw notes.

### Admin-facing

- Admin login.
- List doctor verification applications.
- Review and approve/reject applications.

### Platform capabilities

- Role-protected API endpoints.
- File upload handling with validation.
- OCR and PDF text extraction.
- AI-based analysis and structuring.
- Specialist normalization and matching logic.

---

## 6. Tech Stack

### Backend

- Node.js (ES Modules)
- Express 5
- MongoDB + Mongoose
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Uploads (`multer`)
- Cloudinary
- Google Generative AI SDK
- OCR (`tesseract.js`)
- PDF extraction (`pdf-parse`)

### Frontend

- React 19
- React Router
- Vite
- Tailwind CSS v4
- Axios
- Framer Motion
- i18next + react-i18next
- React Toastify

---

## 7. Repository Structure

```text
Veda/
├── Backend/
│   ├── server.js
│   ├── package.json
│   ├── config/
│   │   ├── db.js
│   │   └── cloudinary.js
│   ├── controllers/
│   │   ├── Auth/
│   │   ├── Case/
│   │   ├── Diagnosis/
│   │   ├── Voice/
│   │   ├── verification/
│   │   ├── consultationController.js
│   │   └── doctorController.js
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── upload.js
│   │   └── verificationUpload.js
│   ├── models/
│   │   ├── Case.js
│   │   ├── Consultation.js
│   │   └── Doctor.js
│   ├── routes/
│   │   ├── AuthRoutes/
│   │   ├── CaseRoutes/
│   │   ├── DiagnosisRoutes/
│   │   ├── consultationRoutes.js
│   │   ├── doctorRoutes.js
│   │   └── voiceRoutes.js
│   ├── Schema/
│   │   ├── patientSchema.js
│   │   ├── doctorSchema.js
│   │   └── diagnosisSchema.js
│   ├── services/
│   │   ├── geminiService.js
│   │   ├── doctorMatchService.js
│   │   ├── specialistService.js
│   │   ├── ocrExtractor.js
│   │   ├── pdfExtractor.js
│   │   └── openRouterService.js
│   └── uploads/
│       ├── diagnosis/
│       └── reports/
├── Frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── i18n.js
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── public/
└── README.md
```

---

## 8. Backend API Reference

Base URL (default local):

- `http://localhost:5000/api`

### 8.1 Auth (`/api/auth`)

- `POST /auth/patient/signup` -> Register patient
- `POST /auth/patient/login` -> Patient login
- `POST /auth/doctor/signup` -> Register doctor
- `POST /auth/doctor/login` -> Doctor login
- `POST /auth/admin/login` -> Admin login

### 8.2 Case Analysis (`/api/case`)

- `POST /case/analyze` -> Patient-protected, multipart intake + report uploads + AI triage

### 8.3 Diagnosis (`/api/diagnosis`)

- `POST /diagnosis/submit` -> Patient-protected diagnosis submission with files
- `GET /diagnosis/my-cases` -> Patient-protected list of own diagnosis cases
- `GET /diagnosis/case/:caseId` -> Patient-protected single diagnosis case

### 8.4 Doctors and Verification (`/api/doctors`)

- `GET /doctors/match/:caseId` -> Patient-protected matched verified doctors
- `POST /doctors/verification` -> Doctor-protected verification submission
- `GET /doctors/verification/me` -> Doctor-protected own verification status
- `GET /doctors/verification/admin/applications` -> Admin-protected list applications
- `PATCH /doctors/verification/admin/:doctorId/review` -> Admin-protected approve/reject

### 8.5 Consultation (`/api/consultation`)

- `POST /consultation/create` -> Patient-protected consultation creation
- `GET /consultation/:id` -> Patient-protected consultation detail
- `GET /consultation/doctor/requests` -> Doctor-protected consultation queue
- `GET /consultation/doctor/all-cases` -> Doctor-protected all doctor cases
- `GET /consultation/doctor/case/:caseId` -> Doctor-protected single case detail
- `GET /consultation/doctor/assignees` -> Doctor-protected available doctors
- `PATCH /consultation/doctor/:id/claim` -> Doctor-protected claim consultation
- `PATCH /consultation/doctor/:id/reassign` -> Doctor-protected reassign consultation
- `PATCH /consultation/doctor/:id/status` -> Doctor-protected status update
- `PATCH /consultation/doctor/:id/response` -> Doctor-protected submit response + structured report

### 8.6 Voice (`/api/voice`)

- `POST /voice/parse` -> Patient-protected voice text to structured fields

### 8.7 Health Check

- `GET /` -> Returns `Running Well`

---

## 9. Data Models

## Patient

Main fields:

- `patientId` (unique, custom identifier)
- `fullName`, `email`, `password`
- `age`, `gender`, `height`, `weight`, `bloodType`
- `phoneNumber`, `city`
- `emergencyContactName`, `emergencyPhone`

## Doctor

Main fields:

- `doctorId` (unique)
- `fullName`, `email`, `password`
- `specialization`, `experience`, `rating`, `availability`
- `clinicName`, `clinicAddress`, `licenseNumber`, `city`, `phoneNumber`
- `isVerified`, `verificationStatus`
- `verificationDetails` object including document metadata

## Case

Main fields:

- `caseId` (unique)
- `patientId` (ObjectId ref)
- `aiAnalysis` (Gemini output, normalized)
- `status` lifecycle (`created`, `ai_completed`, `doctor_requested`, `doctor_assigned`, `consultation_active`, `completed`)
- `situationLevel`, `isEmergencyCase`

## Consultation

Main fields:

- `caseId`, `patientId`, `doctorId` refs
- `status` (`pending`, `accepted`, `rejected`, `completed`)
- `doctorResponse` (notes, plan, tests, follow-up, severity)
- `doctorStructuredReport` (generated JSON)

## Diagnosis

Main fields:

- `caseId` (unique)
- `patientId` (string reference)
- `patientObjectId` (ObjectId ref)
- `symptoms`, `symptomDuration`, `painLevel`
- `existingConditions`, `currentMedications`, `allergies`
- `additionalNotes`
- `uploads[]`
- `status` (`pending`, `under_review`, `reviewed`, `closed`)

---

## 10. Environment Variables

Create `Backend/.env`.

Required:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/veda
JWT_SECRET=replace_with_strong_secret
GEMINI_API_KEY=replace_with_gemini_key
ANTHROPIC_API_KEY=replace_with_api_here
CLOUDINARY_CLOUD_NAME=replace_with_cloud_name
CLOUDINARY_API_KEY=replace_with_api_key
CLOUDINARY_API_SECRET=replace_with_api_secret
```

Optional:

```env
# Optional custom admin users JSON.
# If not set/invalid, defaults are used in code.
ADMIN_CREDENTIALS_JSON=[{"email":"admin@vedaai.com","password":"Admin@123","name":"Super Admin"}]

# Optional, currently not wired to active API routes
OPENROUTER_API_KEY=replace_with_openrouter_key
```

Frontend variable (optional):

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 11. Local Development Setup

### Prerequisites

- Node.js 18+
- npm
- MongoDB (local or Atlas)
- Gemini API key
- Cloudinary account (for doctor verification files)

### 11.1 Backend

```bash
cd Backend
npm install
npm run dev
```

Backend default URL:

- `http://localhost:5000`

### 11.2 Frontend

```bash
cd Frontend
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:5173`

### 11.3 Production scripts

Backend:

```bash
npm run start
```

Frontend:

```bash
npm run build
npm run preview
```

---

## 12. Security and Access Control

Implemented safeguards:

- JWT authentication with role claims.
- Route guards for `patient`, `doctor`, `admin`.
- Doctor verification gate before doctor eligibility.
- Consultation ownership checks in key endpoints.
- File type and size validation in upload middleware.

Current caveat:

- Admin credentials can fall back to default values if `ADMIN_CREDENTIALS_JSON` is missing or invalid. Replace immediately in real deployment.

---

## 13. Validation and Error Behavior

Common backend validation patterns:

- Required body field checks with `400` responses.
- ObjectId checks for route params.
- Role and ownership checks with `403` responses.
- Not found resources with `404` responses.
- Conflict state checks with `409` responses.
- Generic internal errors with `500` responses.

AI response handling:

- JSON cleaning/parsing safeguards for model outputs.
- Fallback behavior for voice parser if AI fails.
- Normalization layer for triage outputs and defaults.

---

## 14. Known Gaps and Current Limitations

- Report delivery API is not fully implemented end-to-end; frontend report utility includes local-storage behavior.
- OpenRouter service exists but is not actively wired into user-facing flows.
- Appointment scheduling and live video consultation are not fully implemented in backend.
- OCR is English-focused and can be slow for large files.
- No async queue for long-running extraction/AI operations.
- No built-in rate limiting, audit logging, or API versioning yet.

---

## 15. Suggested Production Improvements

- Move admin identities to persistent user-role records.
- Add `express-rate-limit` and request auditing.
- Add async job queue for OCR/AI heavy tasks.
- Add centralized observability (logs, traces, metrics).
- Add OpenAPI/Swagger docs and endpoint versioning.
- Add notification channels (email/SMS/in-app) for status changes.
- Add integration and contract tests for major workflows.

---

## 16. Contributing

Suggested contribution flow:

1. Create a feature branch.
2. Keep changes scoped and documented.
3. Add/update tests where possible.
4. Run lint/build before PR.
5. Open PR with summary, screenshots (if UI), and API notes (if backend).

---

## 17. License

No license file is currently present at repository root.

Until a license is added, treat the project as all-rights-reserved by default.
<img width="1900" height="868" alt="Screenshot 2026-03-22 232034" src="https://github.com/user-attachments/assets/cc8e6200-7c30-4543-b9a3-9e4197b08044" />
<img width="1900" height="866" alt="Screenshot 2026-03-22 205747" src="https://github.com/user-attachments/assets/dfee7a24-689b-4de5-b11a-6943d3fdcc40" />
<img width="1901" height="867" alt="Screenshot 2026-03-22 205722" src="https://github.com/user-attachments/assets/c50733ab-b438-4671-a69f-753cfdd223cb" />
<img width="1903" height="870" alt="Screenshot 2026-03-22 205656" src="https://github.com/user-attachments/assets/ed414e1c-2e93-415c-a2a4-bec703859ea6" />

