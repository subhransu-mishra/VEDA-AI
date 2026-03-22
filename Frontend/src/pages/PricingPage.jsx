import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

const cardEase = [0.22, 1, 0.36, 1];
const Motion = motion;

function PricingCard({
  title,
  price,
  description,
  features,
  highlighted = false,
  selected = false,
  onSelect,
}) {
  return (
    <Motion.button
      type="button"
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      onClick={onSelect}
      className={`relative flex flex-col rounded-[45px] border p-10 text-left transition-all duration-700 ${
        selected
          ? "scale-[1.02] border-[#d9f0df]/65 bg-white/10 shadow-[0_0_120px_-12px_rgba(109,143,117,0.38)] backdrop-blur-3xl"
          : highlighted
            ? "border-[#6d8f73]/35 bg-white/8 shadow-[0_0_100px_-20px_rgba(109,143,117,0.24)] backdrop-blur-3xl saturate-150"
            : "border-white/10 bg-white/2 backdrop-blur-2xl hover:bg-white/4"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[45px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />

      {selected ? (
        <div className="absolute right-6 top-6 rounded-full border border-[#d9f0df]/40 bg-[#d9f0df]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#dff6e5]">
          Selected
        </div>
      ) : null}

      <div className="relative mb-8">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-white/50">
          {title}
        </h3>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tighter text-white">
            {price === "Free" ? "Free" : `Rs ${price}`}
          </span>
          {price !== "Free" ? (
            <span className="text-lg font-medium text-white/30">/m</span>
          ) : null}
        </div>
      </div>

      <p className="mb-10 min-h-12 text-sm leading-relaxed text-white/40">
        {description}
      </p>

      <div className="mb-12 flex-1 space-y-5">
        {features.map((feature) => (
          <div key={feature} className="group flex items-center gap-4">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors ${selected ? "bg-[#dff6e5]/16" : "bg-white/10 group-hover:bg-white/20"}`}
            >
              <Check size={14} className="text-white" strokeWidth={3} />
            </div>
            <span className="text-sm font-medium tracking-wide text-white/70">
              {feature}
            </span>
          </div>
        ))}
      </div>

      <div
        className={`w-full rounded-full py-4 text-center text-sm font-bold uppercase tracking-widest transition-all duration-300 ${
          selected
            ? "bg-white text-black shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)]"
            : highlighted
              ? "bg-white/12 text-white"
              : "border border-white/20 bg-transparent text-white"
        }`}
      >
        {selected ? "Plan Selected" : "Select Plan"}
      </div>
    </Motion.button>
  );
}

export default function PricingPage({ session = null }) {
  const { t } = useTranslation();
  const tr = useCallback(
    (key, defaultValue, options = {}) => t(key, { defaultValue, ...options }),
    [t],
  );
  const navigate = useNavigate();

  const lockedRole =
    session?.role === "doctor" || session?.role === "patient"
      ? session.role
      : null;

  const [isAnnual, setIsAnnual] = useState(false);
  const [audiencePreference, setAudiencePreference] = useState("patient");
  const [selectedPlanIndexMap, setSelectedPlanIndexMap] = useState({});

  const audience = lockedRole || audiencePreference;
  const planContextKey = `${audience}_${isAnnual ? "annual" : "monthly"}`;
  const selectedPlanIndex = selectedPlanIndexMap[planContextKey] ?? 1;
  const setSelectedPlanIndex = (index) => {
    setSelectedPlanIndexMap((prev) => ({
      ...prev,
      [planContextKey]: index,
    }));
  };

  const patientPlans = useMemo(
    () => [
      {
        title: tr("pricing.patient.free.title", "Patient Free"),
        price: "Free",
        description: tr(
          "pricing.patient.free.description",
          "For patients trying VedaAI for symptom analysis, private concern support, and emergency access.",
        ),
        features: [
          tr("pricing.patient.free.f1", "General symptom analysis"),
          tr("pricing.patient.free.f2", "Private concern flow"),
          tr("pricing.patient.free.f3", "Emergency support access"),
          tr("pricing.patient.free.f4", "Basic AI summary"),
          tr("pricing.patient.free.f5", "Standard doctor routing"),
        ],
      },
      {
        title: tr("pricing.patient.plus.title", "AI + Doctor Consultation"),
        price: "699",
        highlighted: true,
        description: tr(
          "pricing.patient.plus.description",
          "For patients who want AI triage with doctor consultation in one complete care flow.",
        ),
        features: [
          tr("pricing.patient.plus.f1", "Unlimited AI analyses"),
          tr("pricing.patient.plus.f2", "AI + doctor consultation flow"),
          tr("pricing.patient.plus.f3", "Priority doctor matching"),
          tr("pricing.patient.plus.f4", "Structured consult handoff"),
          tr("pricing.patient.plus.f5", "Case history and follow-up context"),
        ],
      },
      {
        title: tr("pricing.patient.family.title", "Family Care"),
        price: isAnnual ? "649" : "799",
        description: tr(
          "pricing.patient.family.description",
          "For families managing parents, children, and emergency contacts under one plan.",
        ),
        features: [
          tr("pricing.patient.family.f1", "Up to 5 family profiles"),
          tr("pricing.patient.family.f2", "Shared reminders"),
          tr("pricing.patient.family.f3", "Centralized reports"),
          tr("pricing.patient.family.f4", "Shared emergency contacts"),
          tr("pricing.patient.family.f5", "Private concern support for all"),
        ],
      },
    ],
    [isAnnual, tr],
  );

  const doctorPlans = useMemo(
    () => [
      {
        title: tr("pricing.doctor.starter.title", "Doctor Starter"),
        price: isAnnual ? "799" : "999",
        description: tr(
          "pricing.doctor.starter.description",
          "For doctors starting with verified profile access and routed patient intake.",
        ),
        features: [
          tr("pricing.doctor.starter.f1", "Verified doctor profile"),
          tr("pricing.doctor.starter.f2", "Structured case inbox"),
          tr("pricing.doctor.starter.f3", "Consultation report tools"),
          tr("pricing.doctor.starter.f4", "AI intake summary handoff"),
          tr("pricing.doctor.starter.f5", "Basic workflow overview"),
        ],
      },
      {
        title: tr("pricing.doctor.pro.title", "Doctor Pro"),
        price: isAnnual ? "2099" : "2499",
        highlighted: true,
        description: tr(
          "pricing.doctor.pro.description",
          "For doctors using VedaAI actively for patient routing, case handling, and stronger report workflow.",
        ),
        features: [
          tr("pricing.doctor.pro.f1", "Unlimited patient cases"),
          tr("pricing.doctor.pro.f2", "Priority specialist routing"),
          tr("pricing.doctor.pro.f3", "Structured consult reports"),
          tr("pricing.doctor.pro.f4", "Consult history and analytics"),
          tr("pricing.doctor.pro.f5", "Better patient context before consult"),
        ],
      },
      {
        title: tr("pricing.doctor.clinic.title", "Clinic Access"),
        price: isAnnual ? "4199" : "4999",
        description: tr(
          "pricing.doctor.clinic.description",
          "For clinics and hospital teams that need staff access, team workflows, and central billing.",
        ),
        features: [
          tr("pricing.doctor.clinic.f1", "Multi-doctor access"),
          tr("pricing.doctor.clinic.f2", "Staff roles and permissions"),
          tr("pricing.doctor.clinic.f3", "Clinic-wide dashboard"),
          tr("pricing.doctor.clinic.f4", "Invoice billing support"),
          tr("pricing.doctor.clinic.f5", "Priority onboarding"),
        ],
      },
    ],
    [isAnnual, tr],
  );

  const plans = audience === "doctor" ? doctorPlans : patientPlans;
  const selectedPlan = plans[selectedPlanIndex] || plans[0];

  const handleContinue = () => {
    if (!session?.email) {
      navigate(audience === "doctor" ? "/signup/doctor" : "/signup/patient");
      return;
    }

    if (audience === "doctor") {
      navigate(
        session?.verificationStatus === "verified"
          ? "/dashboard/doctor"
          : "/doctor/verification",
      );
      return;
    }

    navigate("/dashboard/patient");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] px-6 py-32 font-sans text-white">
      <div className="absolute left-1/2 top-[-20%] h-175 w-250 -translate-x-1/2 rounded-full bg-[#6d8f73]/20 blur-[180px] opacity-50" />
      <div className="absolute bottom-[-10%] right-[-5%] h-150 w-150 rounded-full bg-[#7b5f49]/20 blur-[150px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="pointer-events-none absolute left-1/2 -top-16 -translate-x-1/2 select-none">
          <h2 className="text-[22vw] font-black uppercase leading-none tracking-tighter text-white/3">
            Pricing
          </h2>
        </div>

        <div className="relative mb-20 pt-10 text-center">
          <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: cardEase }}
          >
            <div className="mb-4 flex justify-center">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.25em] text-white/60">
                {lockedRole
                  ? tr("pricing.role.locked", "Showing {{role}} plans", {
                      role: lockedRole,
                    })
                  : tr("pricing.role.freeSwitch", "Patient and Doctor Plans")}
              </span>
            </div>
            <h1 className="mb-8 text-6xl font-bold tracking-tighter md:text-8xl">
              Veda{" "}
              <span className="font-light italic text-white/40">Pricing</span>
            </h1>
          </Motion.div>

          {!lockedRole ? (
            <div className="mb-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAudiencePreference("patient")}
                className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                  audience === "patient"
                    ? "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.2)]"
                    : "border border-white/15 bg-white/3 text-white/45"
                }`}
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => setAudiencePreference("doctor")}
                className={`rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                  audience === "doctor"
                    ? "bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.2)]"
                    : "border border-white/15 bg-white/3 text-white/45"
                }`}
              >
                Doctor
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-6">
            <span
              className={`text-xs font-black uppercase tracking-[0.2em] transition-opacity ${!isAnnual ? "text-white" : "text-white/30"}`}
            >
              Monthly
            </span>
            <button
              type="button"
              onClick={() => setIsAnnual((prev) => !prev)}
              className="relative h-8 w-16 rounded-full border border-white/20 bg-white/10 p-1 transition-all hover:border-white/40"
            >
              <Motion.div
                animate={{ x: isAnnual ? 32 : 0 }}
                transition={{ duration: 0.25, ease: cardEase }}
                className="h-6 w-6 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"
              />
            </button>
            <span
              className={`text-xs font-black uppercase tracking-[0.2em] transition-opacity ${isAnnual ? "text-white" : "text-white/30"}`}
            >
              Yearly
            </span>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-sm leading-7 text-white/45">
            {audience === "doctor"
              ? tr(
                  "pricing.header.doctor",
                  "Plans built for doctor onboarding, case workflow, structured reports, and clinic growth on VedaAI.",
                )
              : tr(
                  "pricing.header.patient",
                  "Plans built for symptom analysis, private concern support, emergency access, and continuity of care on VedaAI.",
                )}
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard
              key={`${audience}-${plan.title}`}
              {...plan}
              selected={selectedPlanIndex === index}
              onSelect={() => setSelectedPlanIndex(index)}
            />
          ))}
        </div>

        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: cardEase, delay: 0.12 }}
          className="mx-auto mt-10 max-w-3xl rounded-[36px] border border-white/12 bg-white/5 p-6 backdrop-blur-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">
                Selected plan
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {selectedPlan.title}
              </h3>
              <p className="mt-2 text-sm text-white/45">
                {selectedPlan.price === "Free"
                  ? "Free"
                  : `Rs ${selectedPlan.price}/m`}
              </p>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="rounded-full bg-white px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:bg-[#eef6f0] active:scale-95"
            >
              {session?.email
                ? audience === "doctor"
                  ? tr("pricing.cta.loggedDoctor", "Continue as Doctor")
                  : tr("pricing.cta.loggedPatient", "Continue as Patient")
                : audience === "doctor"
                  ? tr("pricing.cta.guestDoctor", "Continue to Doctor Signup")
                  : tr(
                      "pricing.cta.guestPatient",
                      "Continue to Patient Signup",
                    )}
            </button>
          </div>
        </Motion.div>
      </div>
    </div>
  );
}
