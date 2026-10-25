import Link from "next/link";
import { Container } from "@/components/container";
import { Navbar } from "@/components/navbar";

const steps = [
  {
    num: "01",
    tag: "CAPTURE",
    title: "Save something worth remembering.",
    description:
      "Paste any public essay or article URL. RecallLoop pulls the readable text into your personal library without tracking ads or paywall clutter.",
    detail: "Direct HTML extraction · Automatic clean text normalization",
  },
  {
    num: "02",
    tag: "DISTILL",
    title: "AI turns reading into understanding.",
    description:
      "Gemma AI analyzes the text, identifying key concepts and formulating comprehension questions strictly grounded in verbatim article passages.",
    detail: "Zero hallucination · 100% source-grounded excerpts",
  },
  {
    num: "03",
    tag: "RECALL",
    title: "Learn by recalling, not rereading.",
    description:
      "Active recall challenges your brain to retrieve knowledge from memory before flipping. You rate your recall: Forgot, Hard, or Easy.",
    detail: "Self-paced active retrieval · Immediate calibrated feedback",
  },
  {
    num: "04",
    tag: "RETAIN",
    title: "Remember more, with less effort.",
    description:
      "A deterministic Leitner spaced-repetition algorithm schedules future reviews at expanding intervals right before memory decay occurs.",
    detail: "Day 1 → Day 3 → Day 7 → Day 14 → Permanent recall",
  },
];

const featureHighlights = [
  {
    eyebrow: "GROUNDED INTELLIGENCE",
    title: "Verifiable Source Excerpts",
    description:
      "Every generated flashcard references an exact verbatim sentence from the source article. Never filler, never invented facts.",
    badge: "100% Evidence Grounded",
  },
  {
    eyebrow: "DETERMINISTIC SPACED REPETITION",
    title: "Scientifically Calibrated Intervals",
    description:
      "Intervals expand when recall is solid and reset when forgotten. Study only what is due today without arbitrary streak pressure.",
    badge: "Leitner Spacing",
  },
  {
    eyebrow: "PRIVATE & AD-FREE",
    title: "Your Reading Remains Yours",
    description:
      "Open-source under MIT. Zero analytics scripts, zero third-party telemetry, and argon2 password protection with secure sessions.",
    badge: "Zero Trackers",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-dark selection:bg-sage selection:text-forest">
      <Navbar />

      <main id="main-content">
        {/* Cinematic Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-32">
          <Container className="text-center">
            <div className="animate-hero-text">
              <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-surface px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden="true" />
                INTRODUCING RECALLLOOP
              </span>

              {/* Primary H1 matching e2e test assertion */}
              <h1 className="editorial mx-auto mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-dark sm:text-7xl lg:text-[5.5rem] leading-[1.05]">
                Your bookmarks deserve a <em>second life.</em>
              </h1>

              {/* Core Cadence Subheading */}
              <p className="mt-4 text-xl font-medium tracking-tight text-forest sm:text-2xl lg:text-3xl">
                Save it. Learn it. Remember it.
              </p>

              {/* Supporting Editorial Paragraph */}
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg lg:text-xl">
                Turn articles you save into knowledge you keep. Powered by Gemma AI and spaced repetition.
              </p>

              {/* Action CTAs */}
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
                <Link href="/register" className="pill-link">
                  Start Remembering <span aria-hidden="true">↗</span>
                </Link>
                <a href="#how-it-works" className="pill-link-secondary">
                  See How It Works <span aria-hidden="true">↓</span>
                </a>
              </div>

              <p className="mt-5 text-xs font-medium tracking-wide text-muted">
                Open source · Powered by Google Gemma · No credit card required
              </p>
            </div>

            {/* Cinematic Hero Product Preview Mockup */}
            <div className="animate-hero-mockup mx-auto mt-14 max-w-4xl sm:mt-18">
              <div className="preview-board">
                {/* Window Chrome Header */}
                <div className="mb-6 flex items-center justify-between border-b border-black/[0.06] pb-4">
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <span className="h-3 w-3 rounded-full bg-black/15" />
                    <span className="h-3 w-3 rounded-full bg-black/15" />
                    <span className="h-3 w-3 rounded-full bg-black/15" />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted">
                    <span className="inline-block h-2 w-2 rounded-full bg-forest" />
                    <span>Active Session · Card 1 of 3</span>
                  </div>
                  <span className="rounded-full bg-sage px-3 py-1 text-xs font-semibold text-forest">
                    Gemma 4 Grounded
                  </span>
                </div>

                {/* Simulated Flashcard */}
                <div className="preview-paper text-left">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span className="font-semibold uppercase tracking-wider text-forest">
                      DATABASE ARCHITECTURE
                    </span>
                    <span>Interval: 1d → 3d</span>
                  </div>

                  <p className="editorial mt-5 text-2xl font-semibold tracking-tight text-dark sm:text-3xl">
                    What trade-off comes with maintaining a database index?
                  </p>

                  <div className="my-6 border-t border-black/[0.06]" />

                  {/* Grounded Excerpt */}
                  <div className="rounded-xl bg-surface p-4 text-xs leading-relaxed text-muted">
                    <p className="font-medium text-dark/70 mb-1">Verbatim article source excerpt:</p>
                    <p className="italic">
                      &ldquo;Database indexes help locate rows without scanning an entire table. An index requires
                      additional storage and must be updated whenever indexed data changes.&rdquo;
                    </p>
                  </div>

                  {/* Simulated Action Row */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-forest px-5 py-2 text-xs font-semibold text-white">
                        Show Answer
                      </span>
                      <span className="text-xs text-muted">or press Space</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-muted">
                      <span className="rounded-md border border-black/10 px-2 py-1">Forgot (1d)</span>
                      <span className="rounded-md border border-black/10 px-2 py-1">Hard (3d)</span>
                      <span className="rounded-md border border-black/10 px-2 py-1 bg-sage/60 text-forest font-semibold">Easy (7d)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-muted">
                  <span>Queue: 3 due today</span>
                  <span>Calculated via Leitner schedule</span>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* The Read-it-Later Problem Section */}
        <section className="border-y border-black/[0.06] bg-surface py-20 sm:py-28">
          <Container>
            <div className="grid gap-10 md:grid-cols-2 md:gap-16 items-center">
              <div>
                <span className="eyebrow">THE READ-IT-LATER PARADOX</span>
                <h2 className="editorial mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                  A saved link isn’t a learned idea.
                </h2>
                <p className="mt-6 text-base leading-relaxed text-muted sm:text-lg">
                  We collect articles with genuine curiosity. But browser tabs close, reading lists expand into
                  graveyards of unread bookmarks, and insights vanish from memory within 48 hours.
                </p>
                <p className="mt-4 text-base leading-relaxed text-dark sm:text-lg font-medium">
                  RecallLoop transforms passive bookmarking into active retention: a question to ponder, an answer to
                  verify, and a scheduled moment to return.
                </p>
              </div>

              <div className="rounded-3xl border border-black/[0.06] bg-white p-8 sm:p-10 shadow-sm">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-sm">
                      ✕
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark">Traditional Bookmarking</h3>
                      <p className="mt-1 text-sm text-muted">
                        Infinite accumulation without retrieval. Memory fades to zero within days (Ebbinghaus forgetting curve).
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-black/[0.06]" />

                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage text-forest font-bold text-sm">
                      ✓
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark">The RecallLoop Method</h3>
                      <p className="mt-1 text-sm text-muted">
                        Gemma extracts core ideas into questions. Spaced repetition prompts retrieval just before forgetting.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Product Showcase: 4 Core Learning Stages */}
        <section id="how-it-works" className="scroll-mt-16 py-20 sm:py-32">
          <Container>
            <div className="text-center max-w-2xl mx-auto">
              <span className="eyebrow">THE FOUR-STAGE SYSTEM</span>
              <h2 className="editorial mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                From interesting to remembered.
              </h2>
              <p className="mt-4 text-base text-muted sm:text-lg">
                How RecallLoop bridges the gap between passive reading and permanent knowledge.
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="group flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-surface p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-semibold tracking-tight text-forest">{step.num}</span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-muted border border-black/[0.06]">
                        {step.tag}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-tight text-dark">{step.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{step.description}</p>
                  </div>

                  <div className="mt-8 border-t border-black/[0.06] pt-4">
                    <p className="text-xs font-medium text-forest">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Large Feature Showcase Cards */}
        <section id="features" className="scroll-mt-16 pb-20 sm:pb-32">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="eyebrow">ENGINEERED FOR RIGOR</span>
              <h2 className="editorial mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Built for the way your brain actually learns.
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {featureHighlights.map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-3xl border border-black/[0.06] bg-surface p-8 transition-all duration-300 hover:shadow-lg"
                >
                  <span className="eyebrow text-forest">{feat.eyebrow}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight text-dark">{feat.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{feat.description}</p>
                  <div className="mt-8">
                    <span className="inline-block rounded-full bg-white border border-black/[0.08] px-3.5 py-1 text-xs font-semibold text-dark shadow-2xs">
                      {feat.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Cinematic Bottom Call to Action */}
        <section className="pb-24 sm:pb-32">
          <Container>
            <div className="rounded-3xl bg-forest px-8 py-16 text-center text-white sm:py-24 sm:px-12 shadow-xl">
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-sage">
                READY TO RETAIN MORE
              </span>
              <h2 className="editorial mx-auto mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-white !text-white">
                Stop collecting links.
                <br />
                Start remembering ideas.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-base text-white/85 sm:text-lg">
                Join readers and learners giving their bookmarks permanent residence in memory.
              </p>
              <div className="mt-10">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-semibold text-forest transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-md"
                >
                  Start Remembering <span aria-hidden="true" className="ml-2">↗</span>
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      {/* Apple-inspired Minimalist Footer */}
      <footer className="border-t border-black/[0.08] bg-surface py-12 text-sm text-muted">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-dark">
              <span>↻</span> RecallLoop
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Open source under the MIT license. Content generation powered by Google Gemma.
            </p>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-6 text-xs font-medium">
            <a
              href="https://github.com/itsdevcode/recallloop"
              target="_blank"
              rel="noopener noreferrer"
              className="quiet-link"
            >
              GitHub ↗
            </a>
            <Link href="/privacy" className="quiet-link">
              Privacy
            </Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}
