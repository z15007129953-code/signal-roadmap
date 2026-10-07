import { DemoStart } from "@/components/feedback/demo-start";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function Home() {
  const locale = await getLocale();
  const copy = t(locale);
  return (
    <div className="console-frame min-h-screen">
      <header className="console-topbar mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.08em]">
              SIGNAL / ROADMAP
            </p>
            <p className="console-kicker">
              {locale === "zh" ? "反馈空间" : "FEEDBACK SPACE"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">
            {copy.home.preview}
          </span>
          <LanguageToggle locale={locale} />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="console-panel grid content-start gap-8 p-6 sm:p-10">
          <div className="flex items-center justify-between border-b border-rule pb-5">
            <div>
              <p className="console-kicker text-action">
                {locale === "zh" ? "反馈 / 开始" : "FEEDBACK / START"}
              </p>
              <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                {copy.home.title}
              </h1>
            </div>
            <span className="status-tag status-tag--live">
              {copy.home.ready}
            </span>
          </div>
          <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
            {copy.home.description}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <DemoStart locale={locale} />
            <span className="text-xs text-muted">{copy.home.noAccount}</span>
          </div>
          <div className="metric-strip" aria-label={copy.home.metricsLabel}>
            <div>
              <span className="metric-value">24h</span>
              <span className="metric-label">{copy.home.metricDemo}</span>
            </div>
            <div>
              <span className="metric-value">05</span>
              <span className="metric-label">{copy.home.metricStates}</span>
            </div>
            <div>
              <span className="metric-value">01</span>
              <span className="metric-label">{copy.home.metricWorkspace}</span>
            </div>
          </div>
        </section>
        <aside className="console-panel p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between border-b border-rule pb-4">
            <h2 className="text-sm font-semibold tracking-[0.08em]">
              {copy.home.workflow}
            </h2>
            <span className="console-kicker">01—03</span>
          </div>
          <ol className="grid gap-0">
            {[
              ["01", copy.home.step1Title, copy.home.step1Body],
              ["02", copy.home.step2Title, copy.home.step2Body],
              ["03", copy.home.step3Title, copy.home.step3Body],
            ].map(([number, title, body]) => (
              <li key={number} className="console-step">
                <span className="step-number">{number}</span>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </main>
      <footer className="mx-auto grid w-full max-w-7xl gap-2 border-t border-rule px-5 py-6 text-xs text-muted sm:px-8">
        <p className="font-semibold tracking-[0.08em] text-text">
          SIGNAL / ROADMAP
        </p>
        <p className="max-w-3xl">{copy.home.footer}</p>
      </footer>
    </div>
  );
}
