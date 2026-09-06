import { DemoStart } from "@/components/feedback/demo-start";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-6">
        <p className="text-lg font-semibold tracking-tight">
          Signal Roadmap
          <span aria-hidden="true" className="text-action">
            {" "}
            /
          </span>
        </p>
        <p className="text-sm text-muted">An independent product experiment</p>
      </header>
      <main className="grid gap-12 py-12 sm:py-20 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)] lg:gap-16">
        <section className="grid content-start gap-6">
          <p className="text-sm font-semibold tracking-wide text-action">
            A place to be heard
          </p>
          <h1 className="max-w-xl font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.08] tracking-tight">
            Good ideas deserve
            <br className="hidden sm:block" /> a clear next step.
          </h1>
          <p className="max-w-prose text-lg text-muted">
            Bring feedback into the open. Share a suggestion, find related
            ideas, and see where each one stands.
          </p>
          <div className="mt-2 grid gap-3">
            <DemoStart />
            <p className="max-w-prose text-sm text-muted">
              No account needed. A separate workspace, just for this browser,
              for 24 hours. Starting again replaces your current demo session.
            </p>
          </div>
        </section>
        <aside className="grid content-start gap-6 border-t border-rule pt-6 lg:mt-10">
          <h2 className="font-serif text-2xl">Inside the noticeboard</h2>
          <ol className="grid gap-6">
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="text-sm text-muted">01</span>
              <div>
                <h3 className="font-semibold">Find the conversation</h3>
                <p className="mt-1 text-sm text-muted">
                  Browse by board, tag or status. Search for an idea before
                  adding your own.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="text-sm text-muted">02</span>
              <div>
                <h3 className="font-semibold">Give it some context</h3>
                <p className="mt-1 text-sm text-muted">
                  Describe the problem and what would help. Member submissions
                  start in review.
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="text-sm text-muted">03</span>
              <div>
                <h3 className="font-semibold">Keep the status visible</h3>
                <p className="mt-1 text-sm text-muted">
                  Every idea has a readable state, from under review to
                  completed.
                </p>
              </div>
            </li>
          </ol>
        </aside>
      </main>
      <footer className="grid gap-2 border-t border-rule py-6 text-sm text-muted">
        <p className="font-semibold">Development preview</p>
        <p className="max-w-prose">
          Try feedback submission, voting, following, comments and notifications
          in a private workspace. Switch to moderator view to publish a new idea
          immediately, approve submissions, merge duplicates and change status.
          Explore the roadmap and publish release notes linked to completed
          ideas. Workspace settings and launch safeguards are still being built;
          this preview is not a public production service.
        </p>
      </footer>
    </div>
  );
}
