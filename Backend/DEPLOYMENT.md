# Backend Deployment Setup

## 1) Required environment variables

Use these in your backend hosting platform:

- PORT=5000
- NODE_ENV=production
- MONGODB_URI=your_mongodb_connection_string
- JWT_SECRET=your_strong_secret
- GEMINI_API_KEY=your_gemini_key
- CLOUDINARY_CLOUD_NAME=your_cloud_name
- CLOUDINARY_API_KEY=your_api_key
- CLOUDINARY_API_SECRET=your_api_secret
- FRONTEND_URL=https://veda-ai-one-psi.vercel.app
- CORS_ORIGINS=https://veda-ai-one-psi.vercel.app

If you use preview deployments, add them in CORS_ORIGINS as comma-separated values.

Example:

CORS_ORIGINS=https://veda-ai-one-psi.vercel.app,https://veda-ai-git-feature-branch.vercel.app

## 2) Start command

Use:

npm start

The backend server listens on PORT and exposes:

- GET /
- GET /health

## 3) Request flow from frontend

Frontend should call backend API base URL ending with /api.

Example frontend env value:

VITE_API_BASE_URL=https://your-backend-domain.com/api

This aligns with backend routes:

- /api/auth
- /api/diagnosis
- /api/case
- /api/doctors
- /api/consultation
- /api/voice

## 4) CORS behavior

The backend now allows:

- configured browser origins from CORS_ORIGINS and FRONTEND_URL
- non-browser requests without Origin (Postman/server-to-server)

Any unknown browser origin is blocked with HTTP 403.

## 5) Health check

Use /health as your deployment health endpoint.
