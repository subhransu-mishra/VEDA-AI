import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const easeSmooth = [0.22, 1, 0.36, 1];

export default function PricingPage() {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f7f3ee_0%,#efe5d9_48%,#fbf8f3_100%)] px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(123,95,73,0.12),transparent_72%)] blur-3xl" />
        <div className="absolute right-[8%] top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(184,159,132,0.12),transparent_72%)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: easeSmooth }}
        className="relative mx-auto max-w-5xl rounded-[2.6rem] border border-[rgba(123,95,73,0.12)] bg-white/72 px-6 py-14 shadow-[0_30px_80px_-38px_rgba(58,39,28,0.24)] backdrop-blur-xl sm:px-10"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(123,95,73,0.1)] text-[#7b5f49]">
            <Sparkles size={24} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-[#7b5f49]">
            {tr("pricingPage.label", "Pricing")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#1d1815] sm:text-5xl">
            {tr("pricingPage.title", "Pricing is coming next.")}
          </h1>
          <p className="mt-5 text-base leading-7 text-[#675952]">
            {tr(
              "pricingPage.subtitle",
              "We are shaping plans around guided diagnosis, emergency support, and private concern workflows. This page is ready for the next pass.",
            )}
          </p>
          <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#7b5f49]">
            <span>{tr("pricingPage.status", "Placeholder route active")}</span>
            <ArrowUpRight size={16} />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
