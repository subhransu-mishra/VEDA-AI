import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Send,
  Sparkles,
  Stethoscope,
  Upload,
  UserRound,
} from "lucide-react";
import {
  createAnalysisCase,
  getAnalysisCasesForPatient,
  updateAnalysisCaseById,
} from "../utils/analysisStorage";

const easeSmooth = [0.22, 1, 0.36, 1];

const STATUS_STEPS = [
  "creating_report",
  "sending_to_doctor",
  "waiting_for_doctor",
  "accepted_by_doctor",
];

const STATUS_LABEL = {
  creating_report: "Creating report",
  sending_to_doctor: "Sending to doctor",
  waiting_for_doctor: "Waiting for doctor",
  accepted_by_doctor: "Accepted by doctor",
};

const randomDoctors = ["Dr. Mehta", "Dr. Ananya", "Dr. Sharma", "Dr. Rao"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeChatId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const inferDoctorType = (symptoms = "", notes = "") => {
  const text = `${symptoms} ${notes}`.toLowerCase();
  if (text.includes("chest") || text.includes("bp") || text.includes("heart")) {
    return "Cardiologist";
  }
  if (text.includes("sugar") || text.includes("diabetes") || text.includes("thyroid")) {
    return "Endocrinologist";
  }
  if (text.includes("skin") || text.includes("rash")) {
    return "Dermatologist";
  }
  return "General Physician";
};

const buildAiResult = (form, uploads) => {
  const severity = Number(form.severity || 1);
  const urgency = severity >= 8 ? "High" : severity >= 5 ? "Moderate" : "Low";

  return {
    model: "gemini-local-mock",
    summary:
      urgency === "High"
        ? "Your case looks high priority. Please connect with a doctor quickly."
        : "Your details are reviewed. Doctor consultation is recommended for safe next steps.",
    urgency,
    recommendedDoctor: inferDoctorType(form.symptoms, form.notes),
    keyPoints: [
      `Concern: ${form.symptoms || "Not provided"}`,
      `Duration: ${form.duration || "Not provided"}`,
      `Severity: ${severity}/10`,
      uploads.length
        ? `Files: ${uploads.map((f) => f.name).join(", ")}`
        : "Files: none",
    ],
  };
};

const aiFollowUp = (text, ai) => {
  const q = text.toLowerCase();

  if (q.includes("serious") || q.includes("danger")) {
    return "This can be serious depending on symptom progression. If pain increases, breathing issues start, or bleeding appears, seek urgent care.";
  }
  if (q.includes("medicine") || q.includes("tablet")) {
    return "Please avoid self-medication from AI chat alone. Let a doctor confirm medicine based on your case history.";
  }
  if (q.includes("doctor") || q.includes("connect")) {
    return `You can use the "Connect to Doctor" button above. Recommended specialist: ${ai?.recommendedDoctor || "General Physician"}.`;
  }
  if (q.includes("summary")) {
    return ai?.summary || "I can summarize your case after you submit details.";
  }

  return "I understood. I have added this to your context. If you are ready, connect with a doctor so they receive your complete summary.";
};

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : "");

export default function PatientAnalysisPage({ session }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    age: "",
    gender: "",
    symptoms: "",
    duration: "1-2 days",
    severity: 5,
    medications: "",
    allergies: "",
    notes: "",
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [connectingDoctor, setConnectingDoctor] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [activeCase, setActiveCase] = useState(null);

  const history = useMemo(
    () => getAnalysisCasesForPatient(session?.email || ""),
    [session?.email, refreshTick]
  );

  const currentStatus = activeCase?.doctorFlow?.status || "not_started";
  const currentStatusIndex = STATUS_STEPS.indexOf(currentStatus);

  const refresh = () => setRefreshTick((v) => v + 1);

  const appendChat = (role, text) => {
    if (!activeCase?.id || !text.trim()) return null;
    const now = new Date().toISOString();

    const updated = updateAnalysisCaseById(activeCase.id, (prev) => ({
      ...prev,
      chat: [
        ...(prev.chat || []),
        {
          id: makeChatId(),
          role,
          text: text.trim(),
          createdAt: now,
        },
      ],
    }));

    setActiveCase(updated);
    refresh();
    return updated;
  };

  const updateStatus = (status, extra = {}) => {
    if (!activeCase?.id) return;
    const now = new Date().toISOString();

    const updated = updateAnalysisCaseById(activeCase.id, (prev) => ({
      ...prev,
      doctorFlow: {
        ...(prev.doctorFlow || {}),
        ...extra,
        status,
        timeline: [
          ...(prev.doctorFlow?.timeline || []),
          { status, label: STATUS_LABEL[status], at: now },
        ],
      },
    }));

    setActiveCase(updated);
    refresh();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.symptoms.trim()) return;

    setSubmitting(true);

    // TODO(BACKEND): POST /api/analysis/intake with full form + uploads
    // TODO(BACKEND): call Gemini on backend and persist structured output
    await sleep(900);

    const uploads = selectedFiles.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }));

    const ai = buildAiResult(form, uploads);

    const created = createAnalysisCase({
      session,
      form,
      uploads,
      ai,
      doctorFlow: {
        status: "not_started",
        doctorName: "",
        etaMinutes: null,
        returnAt: "",
        timeline: [],
      },
      chat: [
        {
          id: makeChatId(),
          role: "ai",
          text: `I analyzed your details. ${ai.summary}`,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    setActiveCase(created);
    refresh();
    setSubmitting(false);
  };

  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !activeCase?.id) return;

    appendChat("patient", text);
    setChatInput("");

    await sleep(550);
    appendChat("ai", aiFollowUp(text, activeCase.ai));
  };

  const onConnectDoctor = () => {
    if (!activeCase || connectingDoctor || currentStatus === "accepted_by_doctor") return;

    setConnectingDoctor(true);

    // TODO(BACKEND): POST /api/analysis/:id/connect-doctor
    // TODO(BACKEND): stream queue status with SSE/WebSocket
    updateStatus("creating_report");
    setTimeout(() => updateStatus("sending_to_doctor"), 1200);
    setTimeout(() => updateStatus("waiting_for_doctor"), 3000);

    setTimeout(() => {
      const doctorName = randomDoctors[Math.floor(Math.random() * randomDoctors.length)];
      const etaMinutes = 20 + Math.floor(Math.random() * 31);
      const returnAt = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString();

      updateStatus("accepted_by_doctor", { doctorName, etaMinutes, returnAt });

      appendChat(
        "ai",
        `Doctor accepted your case: ${doctorName}. Approx wait time is ${etaMinutes} minutes. Please come back after ${formatDateTime(returnAt)}.`
      );

      setConnectingDoctor(false);
    }, 5600);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(145deg,#e8f4ff_0%,#f8fcff_48%,#edf8f5_100%)] text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-sky-400/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-emerald-300/25 blur-[130px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#2f78d9_1px,transparent_1px)] bg-size-[24px_24px]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-10 pt-24 sm:px-6 sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeSmooth }}
          className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_22px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">VedaAI Core Flow</p>
              <h1 className="mt-1 bg-gradient-to-r from-slate-900 via-blue-800 to-emerald-700 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                Analysis + AI Chat + Doctor Connect
              </h1>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => navigate("/dashboard/patient")}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                <ArrowLeft size={14} />
                Dashboard
              </button>

              <button
                onClick={onConnectDoctor}
                disabled={!activeCase || connectingDoctor || currentStatus === "accepted_by_doctor"}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Stethoscope size={14} />
                {currentStatus === "accepted_by_doctor"
                  ? "Doctor Connected"
                  : connectingDoctor
                  ? "Connecting..."
                  : "Connect to Doctor"}
              </button>
            </div>
          </div>
        </motion.div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.02, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Patient Intake</p>
            <p className="mt-1 text-sm text-slate-600">
              Submit required details once. AI creates summary and chat context.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={form.age}
                onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                placeholder="Age"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
              <select
                value={form.gender}
                onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <input
              required
              value={form.symptoms}
              onChange={(e) => setForm((p) => ({ ...p, symptoms: e.target.value }))}
              placeholder="Main symptom / concern"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={form.duration}
                onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option>Less than 24h</option>
                <option>1-2 days</option>
                <option>3-7 days</option>
                <option>1+ weeks</option>
              </select>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Severity: {form.severity}/10</p>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <input
              value={form.medications}
              onChange={(e) => setForm((p) => ({ ...p, medications: e.target.value }))}
              placeholder="Current medications (optional)"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <input
              value={form.allergies}
              onChange={(e) => setForm((p) => ({ ...p, allergies: e.target.value }))}
              placeholder="Allergies (optional)"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Additional details"
              className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            />

            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Upload size={14} />
              Upload docs/images (optional)
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map((f) => (
                  <span
                    key={`${f.name}-${f.size}`}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Sparkles size={14} />
              {submitting ? "Analyzing..." : "Generate AI Summary"}
            </button>

            {activeCase?.ai && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-blue-700">AI Snapshot</p>
                <p className="mt-1 text-sm text-slate-700">{activeCase.ai.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Urgency: {activeCase.ai.urgency}
                  </span>
                  <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {activeCase.ai.recommendedDoctor}
                  </span>
                </div>
              </div>
            )}
          </motion.form>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: easeSmooth }}
            className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">AI Conversation</p>
                <p className="text-sm text-slate-600">
                  Chat with AI before doctor handoff.
                </p>
              </div>

              <button
                onClick={onConnectDoctor}
                disabled={!activeCase || connectingDoctor || currentStatus === "accepted_by_doctor"}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Stethoscope size={13} />
                Connect to Doctor
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_STEPS.map((step, i) => {
                const done = currentStatusIndex >= i;
                return (
                  <span
                    key={step}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      done
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    {done ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                    {STATUS_LABEL[step]}
                  </span>
                );
              })}
            </div>

            {activeCase?.doctorFlow?.status === "accepted_by_doctor" && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Doctor: {activeCase.doctorFlow.doctorName} • ETA: {activeCase.doctorFlow.etaMinutes} mins • Come back after {formatDateTime(activeCase.doctorFlow.returnAt)}
              </div>
            )}

            <div className="mt-4 h-[430px] overflow-y-auto rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-3">
              {!activeCase ? (
                <div className="grid h-full place-items-center text-center text-sm text-slate-500">
                  Submit intake details to start AI chat.
                </div>
              ) : (
                <div className="space-y-3">
                  {(activeCase.chat || []).map((msg) => {
                    const isAi = msg.role === "ai";
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isAi ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                            isAi
                              ? "border border-slate-200 bg-white text-slate-700"
                              : "bg-slate-900 text-white"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
                            {isAi ? <Bot size={11} /> : <UserRound size={11} />}
                            {isAi ? "AI" : "You"}
                          </div>
                          <p>{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSendChat();
                  }
                }}
                disabled={!activeCase}
                placeholder={activeCase ? "Ask AI anything about your case..." : "Submit intake to enable chat"}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none disabled:bg-slate-50"
              />
              <button
                onClick={onSendChat}
                disabled={!activeCase || !chatInput.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Send size={13} />
                Send
              </button>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: easeSmooth }}
          className="mt-4 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_22px_55px_-35px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-5"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent Analysis Cases</p>
          {!history.length ? (
            <p className="mt-2 text-sm text-slate-500">No history yet.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setActiveCase(row)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                    {row.form?.symptoms || "Untitled case"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(row.createdAt)}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                    <Stethoscope size={12} />
                    {row.ai?.recommendedDoctor || "General Physician"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
