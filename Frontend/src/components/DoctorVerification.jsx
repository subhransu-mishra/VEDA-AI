// src/components/DoctorVerification.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, ShieldX, Upload, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { verificationApi } from "../api/verificationApi";
import {
  findDoctorCacheByEmail,
  updateDoctorVerificationCache,
} from "../utils/authStorage";

const statusBadgeClass = {
  not_submitted: "bg-slate-100 text-slate-700 border-slate-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
  verified: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const normalizeDoc = (value) => {
  if (!value) return { name: "", type: "", url: "", file: null };
  if (typeof value === "string") {
    return { name: value, type: "", url: "", file: null };
  }

  return {
    name: value.name || value.originalName || "",
    type: value.type || value.mimeType || "",
    url: value.url || "",
    file: null,
  };
};

export default function DoctorVerification({ session }) {
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [application, setApplication] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    registrationCouncil: "",
    registrationNumber: "",
    registrationYear: "",
    highestDegree: "",
    universityName: "",
    govtIdType: "Aadhaar",
    govtIdNumber: "",
    licenseDocument: { name: "", type: "", url: "" },
    degreeDocument: { name: "", type: "", url: "" },
    idDocument: { name: "", type: "", url: "" },
    selfieDocument: { name: "", type: "", url: "" },
    acceptDeclaration: false,
    acceptTerms: false,
  });

  const doctorStatus = doctor?.verificationStatus || "not_submitted";

  const statusIcon = useMemo(() => {
    if (doctorStatus === "verified") return <CheckCircle2 size={16} />;
    if (doctorStatus === "rejected") return <ShieldX size={16} />;
    return <Clock3 size={16} />;
  }, [doctorStatus]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const cachedDoctor = findDoctorCacheByEmail(session?.email);
      setDoctor(cachedDoctor || null);

      const response = await verificationApi.getMyVerification({
        token: session?.token,
      });

      const verification = response.verification;
      setApplication(verification || null);

      if (cachedDoctor) {
        const nextDoctor = {
          ...cachedDoctor,
          verificationStatus: verification?.status || "not_submitted",
          verificationReviewReason: verification?.reviewReason || "",
        };
        setDoctor(nextDoctor);

        updateDoctorVerificationCache({
          email: cachedDoctor.email,
          doctorId: cachedDoctor.id,
          verificationStatus: nextDoctor.verificationStatus,
          verificationReviewReason: nextDoctor.verificationReviewReason,
          emitEvent: false,
        });
      }

      setForm({
        registrationCouncil: verification?.section3?.registrationCouncil || "",
        registrationNumber:
          verification?.section3?.registrationNumber ||
          cachedDoctor?.licenseNumber ||
          "",
        registrationYear: verification?.section3?.registrationYear || "",
        highestDegree: verification?.section3?.highestDegree || "",
        universityName: verification?.section3?.universityName || "",
        govtIdType: verification?.section3?.govtIdType || "Aadhaar",
        govtIdNumber: verification?.section3?.govtIdNumber || "",
        licenseDocument: normalizeDoc(verification?.documents?.licenseDocument),
        degreeDocument: normalizeDoc(verification?.documents?.degreeDocument),
        idDocument: normalizeDoc(verification?.documents?.idDocument),
        selfieDocument: normalizeDoc(verification?.documents?.selfieDocument),
        acceptDeclaration: false,
        acceptTerms: false,
      });

      const status = verification?.status || cachedDoctor?.verificationStatus;
      setIsEditing(
        !verification || status === "not_submitted" || status === "rejected",
      );
    } catch (error) {
      setToast(error.message || "Failed to load verification");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.token) {
      setIsLoading(false);
      return;
    }

    loadData();
    const onExternalUpdate = () => {
      void loadData();
    };

    window.addEventListener("veda:doctor-updated", onExternalUpdate);
    return () =>
      window.removeEventListener("veda:doctor-updated", onExternalUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email, session?.token]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const validate = () => {
    const next = {};
    if (!form.registrationCouncil.trim())
      next.registrationCouncil = "Registration council is required.";
    if (!form.registrationNumber.trim())
      next.registrationNumber = "Registration number is required.";
    if (!form.registrationYear.trim())
      next.registrationYear = "Registration year is required.";
    if (!form.highestDegree.trim())
      next.highestDegree = "Highest degree is required.";
    if (!form.universityName.trim())
      next.universityName = "University is required.";
    if (!form.govtIdNumber.trim())
      next.govtIdNumber = "Government ID number is required.";

    if (!form.licenseDocument?.url && !form.licenseDocument?.file)
      next.licenseDocument = "Upload license document.";
    if (!form.degreeDocument?.url && !form.degreeDocument?.file)
      next.degreeDocument = "Upload degree document.";
    if (!form.idDocument?.url && !form.idDocument?.file)
      next.idDocument = "Upload government ID document.";
    if (!form.selfieDocument?.url && !form.selfieDocument?.file)
      next.selfieDocument = "Upload profile photo/selfie.";

    if (!form.acceptDeclaration)
      next.acceptDeclaration = "Declaration must be accepted.";
    if (!form.acceptTerms) next.acceptTerms = "Terms must be accepted.";
    return next;
  };

  const onFile = async (field, file) => {
    if (!file) return;
    setForm((prev) => ({
      ...prev,
      [field]: {
        name: file.name,
        type: file.type || "",
        url: "",
        file,
      },
    }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!doctor || !session?.token) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await verificationApi.submitVerification({
        token: session.token,
        payload: {
          registrationCouncil: form.registrationCouncil.trim(),
          registrationNumber: form.registrationNumber.trim(),
          registrationYear: form.registrationYear.trim(),
          highestDegree: form.highestDegree.trim(),
          universityName: form.universityName.trim(),
          govtIdType: form.govtIdType,
          govtIdNumber: form.govtIdNumber.trim(),
          acceptDeclaration: form.acceptDeclaration,
          acceptTerms: form.acceptTerms,
        },
        files: {
          licenseDocument: form.licenseDocument?.file,
          degreeDocument: form.degreeDocument?.file,
          idDocument: form.idDocument?.file,
          selfieDocument: form.selfieDocument?.file,
        },
      });

      const verification = response.verification;
      setApplication(verification);
      setDoctor((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          verificationStatus: verification.status,
          verificationReviewReason: verification.reviewReason || "",
        };
      });

      setForm((prev) => ({
        ...prev,
        licenseDocument: normalizeDoc(verification?.documents?.licenseDocument),
        degreeDocument: normalizeDoc(verification?.documents?.degreeDocument),
        idDocument: normalizeDoc(verification?.documents?.idDocument),
        selfieDocument: normalizeDoc(verification?.documents?.selfieDocument),
        acceptDeclaration: false,
        acceptTerms: false,
      }));

      updateDoctorVerificationCache({
        email: doctor.email,
        doctorId: doctor.id,
        verificationStatus: verification.status,
        verificationReviewReason: verification.reviewReason || "",
      });

      setIsEditing(false);
      setErrors({});
      setToast(response.message || "Verification submitted");
      window.dispatchEvent(new Event("veda:doctor-updated"));
    } catch (error) {
      setToast(error.message || "Failed to submit verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading verification data...
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Doctor profile not found.
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-[linear-gradient(160deg,#f5fbff_0%,#f8fcff_40%,#f2fff8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Doctor Verification
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Complete your verification
            </h1>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] ${statusBadgeClass[doctorStatus]}`}
          >
            {statusIcon}
            {doctorStatus}
          </span>
        </div>

        {!isEditing && (
          <div className="mb-5 rounded-2xl border border-white/70 bg-white/85 p-4 backdrop-blur-xl">
            {doctorStatus === "pending" && (
              <p className="text-sm text-amber-700">
                Your application is under review.
              </p>
            )}
            {doctorStatus === "rejected" && (
              <div className="space-y-3">
                <p className="text-sm text-rose-700">
                  Rejected reason:{" "}
                  <span className="font-semibold">
                    {doctor.verificationReviewReason ||
                      application?.reviewReason ||
                      "No reason provided"}
                  </span>
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
                >
                  Reapply
                </button>
              </div>
            )}
            {doctorStatus === "verified" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-emerald-700">
                  You are verified. Dashboard unlocked.
                </p>
                <button
                  onClick={() => navigate("/dashboard/doctor")}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {isEditing || doctorStatus === "not_submitted" ? (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2 text-slate-900">
                <FileText size={16} />
                <h2 className="text-sm font-bold uppercase tracking-[0.16em]">
                  Section 1: Details
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name (from signup)"
                  value={doctor.fullName}
                  readOnly
                />
                <Input
                  label="Email (from signup)"
                  value={doctor.email}
                  readOnly
                />
                <Input
                  label="Phone (from signup)"
                  value={doctor.phone || doctor.phoneNumber || ""}
                  readOnly
                />
                <Input
                  label="Specialization (from signup)"
                  value={doctor.specialization}
                  readOnly
                />

                <Input
                  label="Registration Council"
                  value={form.registrationCouncil}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, registrationCouncil: v }))
                  }
                  error={errors.registrationCouncil}
                />
                <Input
                  label="Registration Number"
                  value={form.registrationNumber}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, registrationNumber: v }))
                  }
                  error={errors.registrationNumber}
                />
                <Input
                  label="Registration Year"
                  value={form.registrationYear}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, registrationYear: v }))
                  }
                  error={errors.registrationYear}
                />
                <Input
                  label="Highest Degree"
                  value={form.highestDegree}
                  onChange={(v) => setForm((p) => ({ ...p, highestDegree: v }))}
                  error={errors.highestDegree}
                />
                <Input
                  label="University"
                  value={form.universityName}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, universityName: v }))
                  }
                  error={errors.universityName}
                />

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Government ID Type
                  </label>
                  <select
                    value={form.govtIdType}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, govtIdType: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="PAN">PAN</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>

                <Input
                  label="Government ID Number"
                  value={form.govtIdNumber}
                  onChange={(v) => setForm((p) => ({ ...p, govtIdNumber: v }))}
                  error={errors.govtIdNumber}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/85 p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2 text-slate-900">
                <Upload size={16} />
                <h2 className="text-sm font-bold uppercase tracking-[0.16em]">
                  Section 2: Document Upload
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FileInput
                  label="Medical License Document"
                  value={form.licenseDocument?.name}
                  onFile={(file) => onFile("licenseDocument", file)}
                  error={errors.licenseDocument}
                />
                <FileInput
                  label="Degree Certificate"
                  value={form.degreeDocument?.name}
                  onFile={(file) => onFile("degreeDocument", file)}
                  error={errors.degreeDocument}
                />
                <FileInput
                  label="Government ID Proof"
                  value={form.idDocument?.name}
                  onFile={(file) => onFile("idDocument", file)}
                  error={errors.idDocument}
                />
                <FileInput
                  label="Profile Photo / Selfie"
                  value={form.selfieDocument?.name}
                  onFile={(file) => onFile("selfieDocument", file)}
                  error={errors.selfieDocument}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Files are uploaded to Cloudinary through backend. Existing
                documents can remain unchanged.
              </p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/85 p-5 backdrop-blur-xl">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-slate-900">
                Section 3: Declaration
              </h2>

              <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.acceptDeclaration}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      acceptDeclaration: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4"
                />
                I declare all submitted information and documents are true and
                authentic.
              </label>
              {errors.acceptDeclaration && (
                <p className="mb-2 text-xs text-rose-500">
                  {errors.acceptDeclaration}
                </p>
              )}

              <label className="mb-3 flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.acceptTerms}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, acceptTerms: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4"
                />
                I accept verification terms and consent to data review by admin.
              </label>
              {errors.acceptTerms && (
                <p className="mb-2 text-xs text-rose-500">
                  {errors.acceptTerms}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 rounded-xl cursor-pointer bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit Verification"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-3xl border border-white/70 bg-white/85 p-5 backdrop-blur-xl">
            <p className="text-sm text-slate-600">
              Application submitted. Waiting for admin decision.
            </p>
          </div>
        )}
      </section>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 right-4 z-1600 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
        >
          {toast}
        </motion.div>
      )}
    </main>
  );
}

function Input({ label, value, onChange, readOnly, error }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      <input
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${
          readOnly
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-slate-200 bg-white text-slate-800 focus:border-cyan-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function FileInput({ label, value, onFile, error }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      <input
        type="file"
        onChange={(e) => onFile?.(e.target.files?.[0])}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      {value && (
        <p className="mt-1 text-xs text-slate-500">Selected: {value}</p>
      )}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}
