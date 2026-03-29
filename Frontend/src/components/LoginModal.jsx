// src/components/LoginModal.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { toast } from "react-toastify";
import { authApi } from "../api/authApi";
import {
  createSession,
  findDoctorCacheByEmail,
  upsertDoctorCache,
  upsertPatientCache,
} from "../utils/authStorage";

/**
 * Hidden admin credentials (demo only).
 * TODO(BACKEND): move admin auth to secure backend login.
 */
const ADMIN_CREDENTIALS = [
  { email: "admin@vedaai.com", password: "Admin@123", name: "Super Admin" },
  {
    email: "review@vedaai.com",
    password: "Review@123",
    name: "Verification Admin",
  },
];

const isValidRole = (r) => r === "patient" || r === "doctor";

export default function LoginModal({ open, onClose, onLogin, onOpenSignup }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const roleFromUrl = searchParams.get("role");
  const initialRole = isValidRole(roleFromUrl) ? roleFromUrl : "patient";

  const [form, setForm] = useState({
    role: initialRole,
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    const nextRole = isValidRole(roleFromUrl) ? roleFromUrl : "patient";
    setForm({ role: nextRole, email: "", password: "" });
    setError("");
    setShowPassword(false);
  }, [roleFromUrl]);

  const resetAuthFields = (roleValue = form.role) => {
    setForm({ role: roleValue, email: "", password: "" });
    setError("");
    setShowPassword(false);
  };

  if (!open) return null;

  const setRoleInUrl = (role) => {
    const next = new URLSearchParams(searchParams);
    next.set("modal", "login");
    next.set("role", role);
    setSearchParams(next, { replace: true });
  };

  const closeModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("modal");
    next.delete("role");
    setSearchParams(next, { replace: true });

    resetAuthFields(isValidRole(roleFromUrl) ? roleFromUrl : "patient");
    onClose?.();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    // Hidden admin login through doctor role
    if (form.role === "doctor") {
      const adminMatch = ADMIN_CREDENTIALS.find(
        (a) => a.email.toLowerCase() === email && a.password === password,
      );

      if (adminMatch) {
        try {
          const response = await authApi.adminLogin({ email, password });

          const adminSession = {
            id: response.admin.id,
            role: "admin",
            name: response.admin.name,
            email: response.admin.email,
            token: response.token,
            loggedInAt: new Date().toISOString(),
          };

          resetAuthFields("doctor");
          onLogin?.(adminSession);
          toast.success(response.message || "Admin login successful");
          navigate("/admin/verification");
          return;
        } catch (adminError) {
          const message = adminError.message || "Admin login failed";
          setError(message);
          toast.error(message);
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      if (form.role === "doctor") {
        const response = await authApi.doctorLogin({ email, password });
        const existingDoctor = findDoctorCacheByEmail(email);
        const cachedDoctor = upsertDoctorCache({
          id: response.doctor.id,
          doctorId: response.doctor.doctorId,
          role: "doctor",
          fullName: existingDoctor?.fullName || response.doctor.fullName,
          email: response.doctor.email,
          phone: existingDoctor?.phone || "",
          specialization:
            existingDoctor?.specialization || response.doctor.specialization,
          licenseNumber: existingDoctor?.licenseNumber || "",
          hospitalName: existingDoctor?.hospitalName || "",
          experienceYears: existingDoctor?.experienceYears || 0,
          clinicAddress: existingDoctor?.clinicAddress || "",
          city: existingDoctor?.city || "",
          verificationStatus:
            response.doctor.verificationStatus ||
            existingDoctor?.verificationStatus ||
            "not_submitted",
          verificationReviewReason:
            response.doctor.verificationReviewReason ||
            existingDoctor?.verificationReviewReason ||
            "",
        });

        const nextSession = createSession({
          user: response.doctor,
          role: "doctor",
          token: response.token,
          fallbackFields: {
            verificationStatus: cachedDoctor.verificationStatus,
          },
        });

        resetAuthFields(form.role);
        onLogin?.(nextSession);
        toast.success(response.message || "Login successful");

        navigate(
          cachedDoctor.verificationStatus === "verified"
            ? "/dashboard/doctor"
            : "/doctor/verification",
        );
      } else {
        const response = await authApi.patientLogin({ email, password });

        upsertPatientCache({
          ...response.patient,
          role: "patient",
        });

        const nextSession = createSession({
          user: response.patient,
          role: "patient",
          token: response.token,
        });

        resetAuthFields(form.role);
        onLogin?.(nextSession);
        toast.success(response.message || "Login successful");
        navigate("/dashboard/patient");
      }
    } catch (submitError) {
      const message =
        submitError.message || "Invalid credentials for selected role.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchRole = (role) => {
    setRoleInUrl(role);
    resetAuthFields(role);
  };

  const goToSignup = () => {
    closeModal();
    onOpenSignup?.();
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <Motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeModal}
            className="fixed inset-0 z-5000 bg-black/55 backdrop-blur-[2px] cursor-pointer"
          />

          <div className="pointer-events-none fixed inset-0 z-5010 flex items-center justify-center p-4 sm:p-6">
            <Motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto relative flex max-h-[92svh] w-full max-w-190 overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.45)] lg:h-125"
            >
              <div className="relative hidden w-[42%] bg-[#0a1128] lg:block">
                <img
                  src="/imgg.jpg"
                  alt="Login Background"
                  className="h-full w-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-linear-to-tr from-[#0a1128]/80 via-transparent to-transparent p-10 flex flex-col justify-end">
                  <h2 className="text-3xl font-light tracking-tight text-white uppercase leading-none">
                    Veda <br />
                    <span className="italic font-normal">Health</span>
                  </h2>
                </div>
              </div>

              <div className="flex w-full flex-col bg-white px-8 py-10 lg:w-[58%] lg:px-12">
                <header className="mb-8 flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                      Log In
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Welcome back to your portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="touch-manipulation text-slate-300 hover:text-slate-900 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </header>

                <div className="mb-8 flex gap-6 border-b border-slate-100">
                  {["patient", "doctor"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => switchRole(role)}
                      className={`relative pb-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                        form.role === role
                          ? "text-slate-900"
                          : "text-slate-300 hover:text-slate-500"
                      }`}
                    >
                      {role}
                      {form.role === role && (
                        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-slate-900" />
                      )}
                    </button>
                  ))}
                </div>

                <form onSubmit={submit} className="flex flex-col gap-6">
                  <div className="group relative">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-900">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, email: e.target.value }))
                      }
                      required
                      placeholder="Enter your email"
                      className="touch-manipulation w-full border-b border-slate-200 bg-transparent py-2 text-base sm:text-sm text-slate-900 outline-none transition-colors focus:border-slate-900 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="group relative">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-900">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, password: e.target.value }))
                        }
                        required
                        placeholder="••••••••"
                        className="touch-manipulation w-full border-b border-slate-200 bg-transparent py-2 text-base sm:text-sm text-slate-900 outline-none transition-colors focus:border-slate-900 placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="touch-manipulation absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-[10px] font-bold text-red-500 uppercase">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 w-full bg-[#0a1128] py-3.5 text-[10px] font-bold tracking-[0.3em] text-white uppercase transition-all hover:bg-black active:scale-[0.98] shadow-lg shadow-black/10"
                  >
                    {isSubmitting ? "Signing In..." : "Enter Portal"}
                  </button>
                </form>

                <footer className="mt-10 flex flex-col gap-1 items-center lg:items-start">
                  <p className="text-[10px] text-slate-400">
                    New to Veda?{" "}
                    <button
                      type="button"
                      onClick={goToSignup}
                      className="font-bold text-slate-900 hover:underline"
                    >
                      Join now
                    </button>
                  </p>
                </footer>
              </div>
            </Motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
