import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import {
  FileUp,
  MessageSquareText,
  Route,
  Stethoscope,
  ArrowUpRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function HowToUse() {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const sectionRef = useRef(null);

  const steps = [
    {
      number: "01",
      title: tr("howToUse.steps.s1.title", "Share symptoms"),
      description: tr(
        "howToUse.steps.s1.description",
        "Start with a guided flow that makes it easier to describe symptoms clearly and without pressure."
      ),
      icon: MessageSquareText,
      accent: "#63A9FF",
    },
    {
      number: "02",
      title: tr("howToUse.steps.s2.title", "Add reports"),
      description: tr(
        "howToUse.steps.s2.description",
        "Upload medical reports and notes to create better context."
      ),
      icon: FileUp,
      accent: "#7BB8FF",
    },
    {
      number: "03",
      title: tr("howToUse.steps.s3.title", "Get direction"),
      description: tr(
        "howToUse.steps.s3.description",
        "VedaAI organizes data to point you toward the next care step."
      ),
      icon: Route,
      accent: "#8FC8FF",
    },
    {
      number: "04",
      title: tr("howToUse.steps.s4.title", "Continue care"),
      description: tr(
        "howToUse.steps.s4.description",
        "Get a structured summary for your next doctor conversation."
      ),
      icon: Stethoscope,
      accent: "#63A9FF",
    },
  ];

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 88%", "end 20%"],
  });

  const headingY = useSpring(useTransform(scrollYProgress, [0, 1], [28, -8]), {
    stiffness: 90,
    damping: 24,
    mass: 1,
  });

  const headingOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.24], [0, 1]),
    { stiffness: 80, damping: 22, mass: 1 }
  );

  const bgShift = useSpring(useTransform(scrollYProgress, [0, 1], [0, -26]), {
    stiffness: 60,
    damping: 20,
    mass: 1.2,
  });

  const lineProgress = useSpring(
    useTransform(scrollYProgress, [0.08, 0.72], [0, 1]),
    { stiffness: 80, damping: 22, mass: 1 }
  );

  return (
    <section
      id="how-to-use"
      ref={sectionRef}
      className="relative overflow-hidden py-16 sm:py-20 lg:py-24"
      style={{
        background:
          "radial-gradient(circle at 16% 18%, rgba(99,169,255,0.16), transparent 22%), radial-gradient(circle at 84% 16%, rgba(191,226,255,0.28), transparent 22%), linear-gradient(180deg, #f8fbff 0%, #f2f8ff 50%, #fcfeff 100%)",
      }}
    >
      <motion.div style={{ y: bgShift }} className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,rgba(99,169,255,0.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,169,255,0.7)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute left-[8%] top-8 h-48 w-48 rounded-full bg-[#63A9FF]/20 blur-[90px]" />
        <div className="absolute right-[10%] top-10 h-56 w-56 rounded-full bg-[#CDE7FF]/55 blur-[100px]" />
      </motion.div>

      <div className="section-shell relative z-10 px-5 sm:px-8">
        <motion.header
          style={{ y: headingY, opacity: headingOpacity }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-3 text-[#63A9FF]">
            <span className="h-px w-8 bg-current/50" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em]">
              {tr("howToUse.sectionLabel", "Process")}
            </span>
            <span className="h-px w-8 bg-current/50" />
          </div>

          <h2 className="mt-5 text-3xl font-medium tracking-[-0.05em] text-[#102A43] sm:text-4xl lg:text-5xl">
            {tr("howToUse.titleLine1", "A smoother path to care")}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#6A7F97] sm:text-[15px]">
            {tr(
              "howToUse.subtitle",
              "A simple AI-guided experience that helps patients move from symptoms to the right next step with clarity."
            )}
          </p>
        </motion.header>

        {/* desktop horizontal flow */}
        <div className="relative mx-auto mt-14 hidden max-w-6xl lg:block">
          <div className="absolute left-0 right-0 top-[3rem] h-px bg-gradient-to-r from-[#DDEEFF] via-[#B9DBFF] to-[#E8F4FF]" />
          <motion.div
            style={{ scaleX: lineProgress, transformOrigin: "left" }}
            className="absolute left-0 right-0 top-[3rem] h-px origin-left bg-gradient-to-r from-[#63A9FF] via-[#8FC8FF] to-[#CDE7FF] shadow-[0_0_18px_rgba(99,169,255,0.3)]"
          />

          <div className="grid grid-cols-4 gap-6">
            {steps.map((step, index) => (
              <DesktopStep
                key={step.number}
                step={step}
                index={index}
                progress={scrollYProgress}
                tr={tr}
              />
            ))}
          </div>
        </div>

        {/* mobile stacked flow */}
        <div className="relative mx-auto mt-12 max-w-2xl lg:hidden">
          <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-[#DDEEFF] via-[#8FC8FF] to-[#EAF5FF]" />
          <motion.div
            style={{ scaleY: lineProgress, transformOrigin: "top" }}
            className="absolute left-4 top-0 h-full w-px origin-top bg-gradient-to-b from-[#63A9FF] via-[#8FC8FF] to-[#D7EEFF] shadow-[0_0_18px_rgba(99,169,255,0.25)]"
          />

          <div className="space-y-8">
            {steps.map((step, index) => (
              <MobileStep
                key={step.number}
                step={step}
                index={index}
                progress={scrollYProgress}
                tr={tr}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopStep({ step, index, progress, tr }) {
  const Icon = step.icon;

  const ranges = [
    [0.06, 0.22],
    [0.18, 0.34],
    [0.3, 0.46],
    [0.42, 0.62],
  ];

  const [start, end] = ranges[index];

  const opacity = useSpring(useTransform(progress, [start, end], [0, 1]), {
    stiffness: 90,
    damping: 24,
    mass: 1,
  });

  const y = useSpring(useTransform(progress, [start, end], [24, 0]), {
    stiffness: 100,
    damping: 24,
    mass: 1,
  });

  const scale = useSpring(useTransform(progress, [start, end], [0.96, 1]), {
    stiffness: 100,
    damping: 22,
    mass: 1,
  });

  return (
    <motion.article style={{ opacity, y, scale }} className="relative pt-20">
      <div
        className="absolute left-1/2 top-[1.6rem] z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_25px_-14px_rgba(99,169,255,0.45)] ring-1 ring-[#DCEEFF]"
        style={{ color: step.accent }}
      >
        <Icon size={18} />
      </div>

      <div className="px-3 text-center">
        <div
          className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: step.accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: step.accent }} />
          {tr("howToUse.stepPrefix", "Step")} {step.number}
        </div>

        <h3 className="mt-3 text-xl font-medium tracking-[-0.04em] text-[#102A43]">
          {step.title}
        </h3>

        <p className="mx-auto mt-3 max-w-[240px] text-sm leading-7 text-[#6A7F97]">
          {step.description}
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8AA3BC]">
            {tr("howToUse.flowLabel", "VedaAI Flow")}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#63A9FF] shadow-[0_8px_20px_-12px_rgba(99,169,255,0.42)] ring-1 ring-[#DCEEFF]">
            <ArrowUpRight size={15} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function MobileStep({ step, index, progress, tr }) {
  const Icon = step.icon;

  const ranges = [
    [0.06, 0.22],
    [0.18, 0.34],
    [0.3, 0.46],
    [0.42, 0.62],
  ];

  const [start, end] = ranges[index];

  const opacity = useSpring(useTransform(progress, [start, end], [0, 1]), {
    stiffness: 90,
    damping: 24,
    mass: 1,
  });

  const x = useSpring(useTransform(progress, [start, end], [-20, 0]), {
    stiffness: 100,
    damping: 24,
    mass: 1,
  });

  const y = useSpring(useTransform(progress, [start, end], [24, 0]), {
    stiffness: 100,
    damping: 24,
    mass: 1,
  });

  return (
    <motion.article style={{ opacity, x, y }} className="relative pl-12">
      <div
        className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-[0_10px_20px_-12px_rgba(99,169,255,0.42)] ring-1 ring-[#DCEEFF]"
        style={{ color: step.accent }}
      >
        <Icon size={16} />
      </div>

      <div
        className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em]"
        style={{ color: step.accent }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: step.accent }} />
        {tr("howToUse.stepPrefix", "Step")} {step.number}
      </div>

      <h3 className="mt-2 text-xl font-medium tracking-[-0.04em] text-[#102A43]">
        {step.title}
      </h3>

      <p className="mt-2 text-sm leading-7 text-[#6A7F97]">
        {step.description}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#8AA3BC]">
          {tr("howToUse.flowLabel", "VedaAI Flow")}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[#63A9FF] shadow-[0_8px_18px_-12px_rgba(99,169,255,0.42)] ring-1 ring-[#DCEEFF]">
          <ArrowUpRight size={15} />
        </div>
      </div>
    </motion.article>
  );
}