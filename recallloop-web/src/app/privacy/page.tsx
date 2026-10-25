import Link from "next/link";
import { Container } from "@/components/container";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-dark selection:bg-sage selection:text-forest">
      <header className="border-b border-black/[0.06] bg-white/80 py-4 backdrop-blur-md sticky top-0 z-50">
        <Container className="max-w-3xl flex items-center justify-between">
          <Link className="brand" href="/" aria-label="RecallLoop home">
            <span aria-hidden="true" className="text-xl">↻</span>
            <span className="text-lg font-semibold tracking-tight text-dark">RecallLoop</span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-muted hover:text-dark transition-colors">
            ← Back to Home
          </Link>
        </Container>
      </header>

      <Container className="max-w-3xl py-12 sm:py-20">
        <main id="main-content" className="space-y-10">
          <div className="space-y-4">
            <span className="eyebrow text-forest">PRIVACY & DATA GOVERNANCE</span>
            <h1 className="editorial text-4xl font-semibold tracking-tight text-dark sm:text-5xl">
              Your reading, your data.
            </h1>
            <p className="text-base leading-relaxed text-muted sm:text-lg">
              RecallLoop stores your account name, email, password hash, saved
              article URLs and extracted content, generated learning cards, and
              review history. Passwords are hashed with Argon2; login uses a
              short-lived HttpOnly cookie.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-black/[0.06] bg-surface p-7 sm:p-9 shadow-2xs">
            <h2 className="text-xl font-semibold tracking-tight text-dark">AI processing</h2>
            <p className="text-sm leading-relaxed text-muted">
              When you save or retry an article, selected extracted text is sent to
              Google’s hosted Gemma service to generate learning material. Your
              reading may contain personal information. Only save public articles
              you are comfortable sending to that provider. AI output can be
              incomplete or incorrect; check the original source.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-black/[0.06] bg-surface p-7 sm:p-9 shadow-2xs">
            <h2 className="text-xl font-semibold tracking-tight text-dark">Storage and deletion</h2>
            <p className="text-sm leading-relaxed text-muted">
              Deleting an article removes its stored text, concepts, cards, and
              review history from the application database. Provider retention and
              infrastructure backups are governed separately by their operators.
              Logout clears your cookie; an already issued access token remains
              valid until its 15-minute expiration.
            </p>
          </div>

          <div className="space-y-3 rounded-3xl border border-black/[0.06] bg-surface p-7 sm:p-9 shadow-2xs">
            <h2 className="text-xl font-semibold tracking-tight text-dark">This release</h2>
            <p className="text-sm leading-relaxed text-muted">
              The application code includes no analytics or advertising trackers.
              Hosting providers may keep operational logs. An operator contact,
              final hosting details, backup retention policy, and account deletion
              process must be supplied before a public deployment accepts personal
              data.
            </p>
          </div>

          <div className="pt-4 border-t border-black/[0.08]">
            <Link href="/" className="quiet-link font-semibold text-forest">
              Back to RecallLoop
            </Link>
          </div>
        </main>
      </Container>
    </div>
  );
}
