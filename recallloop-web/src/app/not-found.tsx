import Link from "next/link";
import { Container } from "@/components/container";

export default function NotFound() {
  return (
    <Container className="py-20">
      <main id="main-content" className="max-w-xl">
        <p className="eyebrow">RecallLoop · 404</p>
        <h1 className="editorial mt-5 text-5xl">This page has moved on.</h1>
        <p className="mt-5 text-muted">
          The link may be incomplete, or the page may no longer exist.
        </p>
        <Link href="/dashboard" className="pill-link mt-8">
          Return to your workspace
        </Link>
      </main>
    </Container>
  );
}
