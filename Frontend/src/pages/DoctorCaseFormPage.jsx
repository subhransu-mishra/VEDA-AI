import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doctorDashboardApi } from "../api/doctorDashboardApi";

const severityOptions = ["normal", "medium", "serious", "critical"];

export default function DoctorCaseFormPage({ session }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [caseItem, setCaseItem] = useState(null);

  const [form, setForm] = useState({
    caseNotes: "",
    medicationPlan: "",
    testRequirements: "",
    followUpAfter: "",
    severity: "normal",
    confirmedByDoctor: false,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const loadCase = async () => {
      if (!session?.token || !id) return;

      setIsLoading(true);
      setError("");

      try {
        const response = await doctorDashboardApi.getDoctorCaseByCaseId({
          token: session.token,
          caseId: id,
        });

        const item = response?.item || null;
        if (!item) {
          setError("Case not found.");
          setCaseItem(null);
          return;
        }

        setCaseItem(item);
        setForm((prev) => ({
          ...prev,
          caseNotes: item?.doctorResponse?.caseNotes || "",
          medicationPlan: item?.doctorResponse?.medicationPlan || "",
          testRequirements: item?.doctorResponse?.testRequirements || "",
          followUpAfter: item?.doctorResponse?.followUpAfter || "",
          severity: item?.doctorResponse?.severity || "normal",
          confirmedByDoctor: false,
        }));
      } catch (loadError) {
        setError(loadError.message || "Failed to load case details");
        setCaseItem(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadCase();
  }, [session?.token, id]);

  const patientMeta = useMemo(() => {
    return [
      { label: "Patient", value: caseItem?.patientName || "N/A" },
      { label: "Age", value: caseItem?.patientAge ?? "N/A" },
      { label: "Height", value: caseItem?.patientHeight ?? "N/A" },
      { label: "Weight", value: caseItem?.patientWeight ?? "N/A" },
      { label: "Gender", value: caseItem?.patientGender || "N/A" },
      { label: "Blood Type", value: caseItem?.patientBloodType || "N/A" },
    ];
  }, [caseItem]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!caseItem?.consultationId) {
      setToast("Consultation is missing for this case");
      return;
    }

    if (!form.medicationPlan.trim()) {
      setToast("Please fill medicine and dose details");
      return;
    }

    if (!form.followUpAfter.trim()) {
      setToast("Please enter follow-up timing");
      return;
    }

    if (!form.confirmedByDoctor) {
      setToast("Please confirm the response before sending");
      return;
    }

    setIsSubmitting(true);

    try {
      await doctorDashboardApi.submitDoctorCaseResponse({
        token: session?.token,
        consultationId: caseItem.consultationId,
        payload: {
          caseNotes: form.caseNotes,
          medicationPlan: form.medicationPlan,
          testRequirements: form.testRequirements,
          followUpAfter: form.followUpAfter,
          severity: form.severity,
          confirmedByDoctor: form.confirmedByDoctor,
        },
      });

      setToast("Doctor response sent successfully");
      navigate("/dashboard/doctor");
    } catch (submitError) {
      setToast(submitError.message || "Failed to send doctor response");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="min-h-[70vh] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/70 bg-white/70 p-8 text-slate-600 shadow-sm">
          Loading case form...
        </div>
      </section>
    );
  }

  if (error || !caseItem) {
    return (
      <section className="min-h-[70vh] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50/70 p-8 text-rose-700 shadow-sm">
          <p className="font-semibold">{error || "Case not found"}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/doctor")}
            className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-rose-100"
          >
            Back to dashboard
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[70vh] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        {toast && (
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-md">
            {toast}
          </div>
        )}

        <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Doctor Case Form
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            Case {caseItem.id}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{caseItem.complaint}</p>
        </div>

        <div className="grid gap-3 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
          {patientMeta.map((meta) => (
            <p key={meta.label} className="text-sm text-slate-700">
              <span className="font-semibold">{meta.label}:</span> {meta.value}
            </p>
          ))}
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl sm:p-6"
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-800">
              What is the case? (optional)
            </span>
            <textarea
              value={form.caseNotes}
              onChange={(e) => updateField("caseNotes", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
              placeholder="Write case notes"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-800">
              What medicine can be taken and how many doses?
            </span>
            <textarea
              value={form.medicationPlan}
              onChange={(e) => updateField("medicationPlan", e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
              placeholder="Medicine + dosage instructions"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-800">
              Any test required? (optional)
            </span>
            <textarea
              value={form.testRequirements}
              onChange={(e) => updateField("testRequirements", e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
              placeholder="Required tests, if any"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-800">
                Consult after how much time?
              </span>
              <input
                value={form.followUpAfter}
                onChange={(e) => updateField("followUpAfter", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
                placeholder="e.g. 5 days"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-800">
                Severity of pain
              </span>
              <select
                value={form.severity}
                onChange={(e) => updateField("severity", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400"
              >
                {severityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.confirmedByDoctor}
              onChange={(e) =>
                updateField("confirmedByDoctor", e.target.checked)
              }
              className="mt-1"
            />
            <span>
              I confirm that I have reviewed and provided this response.
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard/doctor")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
