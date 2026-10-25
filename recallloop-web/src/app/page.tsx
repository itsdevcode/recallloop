import Link from "next/link";
import { Container } from "@/components/container";

const steps = [
  [
    "01",
    "Save something worth keeping.",
    "An essay, a useful guide, an idea you want to come back to. Add a public article to your library.",
  ],
  [
    "02",
    "Find the ideas inside.",
    "Hosted Gemma turns the article into source-grounded concepts and question–answer cards.",
  ],
  [
    "03",
    "Give your memory a moment.",
    "Read a question. Think it through. Reveal the answer and rate your recall: Forgot, Hard or Easy.",
  ],
  [
    "04",
    "Return at the right time.",
    "A deterministic schedule brings each card back when it is due. Your next session is already taking shape.",
  ],
];

export default function Home() {
  return (
    <div>
      <header className="border-b border-forest/10 py-5">
        <Container className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="brand" aria-label="RecallLoop home">
            <span aria-hidden="true">↻</span> RecallLoop
          </Link>
          <nav
            aria-label="Main"
            className="flex items-center gap-4 text-sm font-medium"
          >
            <Link href="/login" className="quiet-link">
              Log in
            </Link>
            <Link href="/register" className="pill-link">
              Get started <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </Container>
      </header>
      <main id="main-content">
        <Container className="py-16 sm:py-24 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <p className="eyebrow mb-7">
                A little less saving. A little more knowing.
              </p>
              <h1 className="editorial text-5xl leading-[1.06] tracking-tight sm:text-7xl lg:text-[5.5rem]">
                Your bookmarks deserve a <em>second life.</em>
              </h1>
              <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
                Turn saved articles into lasting knowledge with AI-powered
                recall and spaced repetition.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Link href="/register" className="pill-link">
                  Start Remembering <span aria-hidden="true">↗</span>
                </Link>
                <a
                  href="#how-it-works"
                  className="quiet-link text-sm font-semibold"
                >
                  See How It Works <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className="mt-6 text-xs text-muted">
                Open source. Thoughtfully built for curious minds.
              </p>
            </div>
            <figure className="preview-board">
              <div className="mb-7 flex items-center justify-between gap-3 text-xs">
                <span className="eyebrow">A moment of recall</span>
                <span className="rounded-full bg-sage px-3 py-2">
                  Question first
                </span>
              </div>
              <div className="preview-paper">
                <p className="eyebrow text-muted">
                  From your reading · Database indexes
                </p>
                <p className="editorial mt-7 text-3xl leading-snug sm:text-4xl">
                  What trade-off comes with a database index?
                </p>
                <div className="my-7 h-px bg-forest/10" />
                <p className="text-sm leading-relaxed text-muted">
                  Take a breath. Try to recall the idea before checking your
                  answer.
                </p>
                <span className="mt-6 inline-flex rounded-full border border-forest/20 px-5 py-3 text-sm font-medium">
                  Show Answer
                </span>
              </div>
              <figcaption className="mt-5 text-xs leading-relaxed text-muted">
                Illustrative preview of the real question → reveal → rate
                workflow. Your cards come from your saved articles.
              </figcaption>
            </figure>
          </div>
        </Container>
        <section
          className="border-y border-forest/10 bg-sage/35 py-16 sm:py-20"
          aria-labelledby="problem-title"
        >
          <Container className="grid gap-8 md:grid-cols-2 md:gap-20">
            <p className="eyebrow">The read-it-later problem</p>
            <div>
              <h2 id="problem-title" className="editorial text-3xl sm:text-4xl">
                A saved link isn’t a learned idea.
              </h2>
              <p className="mt-5 leading-relaxed text-muted">
                We collect articles with the best intentions. Then the tabs
                close, the bookmarks pile up, and the ideas fade. Reading is a
                beginning. Remembering takes coming back.
              </p>
              <p className="mt-4 leading-relaxed">
                RecallLoop gives your reading a next step: a question to think
                about, and a reason to return.
              </p>
            </div>
          </Container>
        </section>
        <section
          id="how-it-works"
          className="scroll-mt-8 py-16 sm:py-24"
          aria-labelledby="works-title"
        >
          <Container>
            <p className="eyebrow">A simple learning loop</p>
            <h2
              id="works-title"
              className="editorial mt-4 text-4xl sm:text-5xl"
            >
              From interesting to remembered.
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(([number, title, description]) => (
                <article
                  key={number}
                  className="border-t border-forest/20 pt-6"
                >
                  <span className="editorial text-3xl text-muted">
                    {number}
                  </span>
                  <h3 className="mt-6 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>
        <section className="pb-16 sm:pb-24" aria-labelledby="why-title">
          <Container>
            <div className="rounded-3xl bg-forest p-7 text-ivory sm:p-12">
              <p className="eyebrow text-sage">Made for the way you learn</p>
              <h2
                id="why-title"
                className="editorial mt-4 max-w-xl text-4xl sm:text-5xl"
              >
                Less noise. More of what stays.
              </h2>
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="font-semibold">
                    Your reading, made meaningful
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ivory/80">
                    Keep useful articles together and revisit their ideas, with
                    AI-generated questions grounded in the source.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold">One question at a time</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ivory/80">
                    Focused recall sessions and adaptive review scheduling. No
                    streaks to chase. Just a practice you can return to.
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </section>
        <section className="pb-20 text-center sm:pb-28">
          <Container>
            <p className="eyebrow">Make your next read count</p>
            <h2 className="editorial mx-auto mt-5 max-w-2xl text-4xl sm:text-5xl">
              Stop collecting links.
              <br />
              Start remembering ideas.
            </h2>
            <Link href="/register" className="pill-link mt-8">
              Start Remembering <span aria-hidden="true">↗</span>
            </Link>
          </Container>
        </section>
      </main>
      <footer className="border-t border-forest/15 py-8">
        <Container className="flex flex-wrap items-center justify-between gap-5 text-sm">
          <div>
            <p className="font-semibold">RecallLoop</p>
            <p className="mt-2 text-xs text-muted">
              Open source under the MIT license. Content generation powered by
              Gemma.
            </p>
          </div>
          <nav aria-label="Footer" className="flex gap-5">
            <a
              className="quiet-link"
              href="https://github.com/itsdevcode/recallloop"
            >
              GitHub ↗
            </a>
            <Link className="quiet-link" href="/privacy">
              Privacy
            </Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}
