import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function SignupModal({ open, onClose, onOpenLogin }) {
  const { t } = useTranslation();
  const tr = (key, defaultValue, options = {}) =>
    t(key, { defaultValue, ...options });

  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-3000 bg-black/35 backdrop-blur-sm"
      />

      <div className="fixed inset-0 z-3010 grid place-items-center overflow-y-auto px-4 py-6 sm:py-8">
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-slate-700"
          >
            x
          </button>

          <main className="relative flex min-h-140 flex-col items-center justify-center overflow-hidden bg-[#fbfcfd] px-6 py-12">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(at_top_right,rgba(206,233,252,0.4),transparent_50%),radial-gradient(at_top_left,rgba(235,232,255,0.4),transparent_50%)]" />
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02]" />

            <section className="w-full max-w-sm">
              <div className="mb-12 text-center">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {tr("signupModal.title", "Sign up as")}
                </h1>
                <p className="mt-1 text-sm text-slate-500 text-pretty">
                  {tr("signupModal.subtitle", "Choose an option to continue")}
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={() => {
                    onClose?.();
                    navigate("/signup/doctor");
                  }}
                  className="group flex w-full items-center justify-between rounded-full border border-slate-200 bg-white/60 p-2 pl-8 pr-2 transition-all hover:border-cyan-200 hover:bg-cyan-50/50 hover:shadow-lg hover:shadow-cyan-500/5 active:scale-[0.98]"
                >
                  <span className="text-base font-medium text-slate-700">
                    {tr("common.doctor", "Doctor")}
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-cyan-600">
                    <span className="text-lg">→</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onClose?.();
                    navigate("/signup/patient");
                  }}
                  className="group flex w-full items-center justify-between rounded-full border border-slate-200 bg-white/60 p-2 pl-8 pr-2 transition-all hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.98]"
                >
                  <span className="text-base font-medium text-slate-700">
                    {tr("common.patient", "Patient")}
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white transition-colors group-hover:bg-blue-600">
                    <span className="text-lg">→</span>
                  </div>
                </button>
              </div>

              <p className="mt-12 text-center text-xs text-slate-400">
                {tr(
                  "signupModal.alreadyHaveAccount",
                  "Already have an account?",
                )}{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onOpenLogin?.();
                  }}
                  className="font-medium text-slate-600 underline underline-offset-4"
                >
                  {tr("signupModal.logIn", "Log in")}
                </button>
              </p>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
