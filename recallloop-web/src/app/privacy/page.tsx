import Link from "next/link";
import { Container } from "@/components/container";

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-12 sm:py-20">
      <Link className="brand" href="/">
        ↻ RecallLoop
      </Link>
      <main id="main-content" className="mt-12 space-y-7">
        <h1 className="editorial text-5xl">Your reading, your data.</h1>
        <p>
          RecallLoop stores your account name, email, password hash, saved
          article URLs and extracted content, generated learning cards, and
          review history. Passwords are hashed with Argon2; login uses a
          short-lived HttpOnly cookie.
        </p>
        <h2 className="text-xl font-semibold">AI processing</h2>
        <p>
          When you save or retry an article, selected extracted text is sent to
          Google’s hosted Gemma service to generate learning material. Your
          reading may contain personal information. Only save public articles
          you are comfortable sending to that provider. AI output can be
          incomplete or incorrect; check the original source.
        </p>
        <h2 className="text-xl font-semibold">Storage and deletion</h2>
        <p>
          Deleting an article removes its stored text, concepts, cards, and
          review history from the application database. Provider retention and
          infrastructure backups are governed separately by their operators.
          Logout clears your cookie; an already issued access token remains
          valid until its 15-minute expiration.
        </p>
        <h2 className="text-xl font-semibold">This release</h2>
        <p>
          The application code includes no analytics or advertising trackers.
          Hosting providers may keep operational logs. An operator contact,
          final hosting details, backup retention policy, and account deletion
          process must be supplied before a public deployment accepts personal
          data.
        </p>
        <Link href="/" className="quiet-link font-semibold">
          Back to RecallLoop
        </Link>
      </main>
    </Container>
  );
}
