import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

const avatars = [
  { name: "Aarav", initials: "AR", image: "/rimg1.jpg" },
  { name: "Riya", initials: "RI", image: "/rimg2.jpg" },
  { name: "Kabir", initials: "KA", image: "/rimg3.jpg" },
  { name: "Meera", initials: "ME", image: "/rimg4.jpg" },
  { name: "Diya", initials: "DI", image: "/rimg5.jpg" },
  { name: "Ishaan", initials: "IS", image: "/rimg6.jpg" },
];

const easeSmooth = [0.22, 1, 0.36, 1];

const urgentPulse = {
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(185,56,47,0.18), 0 14px 32px -18px rgba(185,56,47,0.92)",
      "0 0 0 8px rgba(185,56,47,0.05), 0 20px 40px -18px rgba(185,56,47,1)",
      "0 0 0 0 rgba(185,56,47,0.18), 0 14px 32px -18px rgba(185,56,47,0.92)",
    ],
    scale: [1, 1.018, 1],
  },
  transition: {
    duration: 1.8,
    repeat: Number.POSITIVE_INFINITY,
    ease: "easeInOut",
  },
};

function EmergencyHeroButton({ label, onClick }) {
  return (
    <motion.button
      type="button"
      animate={urgentPulse.animate}
      transition={urgentPulse.transition}
      onClick={onClick}
      className="relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/12 bg-[linear-gradient(135deg,#b9382f_0%,#d14b40_55%,#8f231c_100%)] px-5 py-3 text-sm font-semibold text-white"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_38%)]" />
      <ShieldAlert size={16} className="relative" />
      <span className="relative">{label}</span>
    </motion.button>
  );
}

export default function Hero({
  onGetStarted = () => {},
  onOpenEmergency = () => {},
  isLoggedIn = false,
  session = null,
}) {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const [showMessage, setShowMessage] = useState(false);
  const [typedText, setTypedText] = useState("");

  const showMobileGetStarted = isLoggedIn && session?.role === "patient";

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setShowMessage(true);
    }, 900);
    return () => clearTimeout(revealTimer);
  }, []);

  useEffect(() => {
    if (!showMessage) return;

    const helperText = tr(
      "hero.helperText",
      "Some patients find it difficult to talk openly about sensitive health concerns. VedaAI helps them express symptoms more comfortably.",
    );

    setTypedText("");
    let index = 0;
    const typeTimer = setInterval(() => {
      index += 1;
      setTypedText(helperText.slice(0, index));
      if (index >= helperText.length) clearInterval(typeTimer);
    }, 18);

    return () => clearInterval(typeTimer);
  }, [showMessage, t]);

  return (
    <section
      id="home"
      className="relative isolate min-h-screen overflow-hidden pt-28 sm:pt-32"
    >
      <div className="hero-futuristic-bg" />
      <div className="hero-vignette-light" />

      <div className="section-shell relative flex min-h-[calc(100vh-7rem)] items-center justify-center pb-32 pt-12 sm:pb-28">
        <div className="w-full max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, ease: easeSmooth }}
            className="glass-panel mx-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--color-primary)] sm:text-sm"
          >
            <span className="h-2 w-2 rounded-full bg-[#5b9fff]" />
            {tr("hero.badge", "AI healthcare for everyone")}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.05, delay: 0.06, ease: easeSmooth }}
            className="mx-auto mt-8 max-w-3xl text-[3rem] font-semibold leading-[0.9] tracking-[-0.09em] text-[var(--color-text)] sm:text-[4.8rem] lg:text-[6rem]"
          >
            {tr("hero.titleLine1", "Better care.")}
            <br />
            {tr("hero.titleLine2", "Less confusion.")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.05, delay: 0.14, ease: easeSmooth }}
            className="mx-auto mt-6 max-w-lg px-2 text-[0.95rem] leading-7 text-[var(--color-text-muted)] sm:text-[1.05rem]"
          >
            {tr(
              "hero.subtitle",
              "VedaAI helps patients understand symptoms, organize reports, and reach the right care path with clarity.",
            )}
          </motion.p>

          {showMobileGetStarted && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.22, ease: easeSmooth }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:hidden"
            >
              <button
                type="button"
                onClick={onGetStarted}
                className="btn-primary cursor-pointer px-6 py-3 text-sm font-semibold"
              >
                {tr("common.getStarted", "Begin Diagnosis")}
              </button>
              <EmergencyHeroButton
                className="cursor-pointer"
                label={tr("common.urgentHelp", "Need Help?")}
                onClick={onOpenEmergency}
              />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.95, delay: 0.24, ease: easeSmooth }}
            className="mt-8 hidden items-center justify-center gap-3 lg:flex"
          >
            {showMobileGetStarted ? (
              <button
                type="button"
                onClick={onGetStarted}
                className="btn-primary cursor-pointer px-6 py-3 text-sm font-semibold"
              >
                {tr("common.getStarted", "Begin Diagnosis")}
              </button>
            ) : null}

            <EmergencyHeroButton
              label={tr("common.urgentHelp", "Need Help?")}
              onClick={onOpenEmergency}
            />
          </motion.div>
        </div>

        {showMessage && (
          <>
            <motion.div
              initial={{ opacity: 0, x: -22, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.55, ease: easeSmooth }}
              className="absolute bottom-18 left-0 hidden w-full max-w-[270px] lg:block"
            >
              <div className="glass-panel rounded-[24px] px-4 py-3 shadow-[0_20px_45px_-28px_rgba(31,51,74,0.45)]">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#5b9fff] shadow-[0_0_10px_rgba(91,159,255,0.55)]" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                      {tr("hero.sensitiveCare", "Sensitive Care")}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold leading-5 text-[var(--color-text)]">
                      {tr(
                        "hero.mobileHelperText",
                        "Private support for sensitive symptoms.",
                      )}
                    </p>
                    <p className="mt-2 min-h-[54px] text-[12px] leading-5 text-[var(--color-text-muted)]">
                      {typedText}
                      <span className="ml-1 inline-block h-3.5 w-[2px] animate-pulse bg-[var(--color-primary)] align-middle opacity-75" />
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -14, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.5, ease: easeSmooth }}
              className="absolute bottom-26 left-4 right-4 max-w-[220px] lg:hidden"
            >
              <div className="glass-panel rounded-[22px] px-3.5 py-3 shadow-[0_16px_34px_-24px_rgba(31,51,74,0.45)]">
                <div className="flex items-start gap-2.5">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#5b9fff] shadow-[0_0_8px_rgba(91,159,255,0.5)]" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                      {tr("hero.sensitiveCare", "Sensitive Care")}
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-muted)]">
                      {tr(
                        "hero.mobileHelperText",
                        "Private support for sensitive symptoms.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.28, ease: easeSmooth }}
          className="absolute bottom-14 right-0 flex w-full items-end justify-center px-2 sm:bottom-8 sm:justify-end sm:px-0"
        >
          <div className="flex items-center gap-3">
            <div className="flex -space-x-3">
              {avatars.map((avatar, index) => (
                <motion.div
                  key={avatar.name}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.34 + index * 0.04,
                    ease: easeSmooth,
                  }}
                  className="avatar-ring relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#d9ede3,#9fd3c5)] text-[11px] font-semibold text-[#234d55] sm:h-11 sm:w-11"
                >
                  {avatar.image ? (
                    <img
                      src={avatar.image}
                      alt={avatar.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    avatar.initials
                  )}
                </motion.div>
              ))}
            </div>
            <p className="text-sm font-semibold text-[var(--color-text)] sm:text-base">
              {tr("hero.happyClients", "100+ happy clients")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
