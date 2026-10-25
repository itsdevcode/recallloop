"use client";

import { Button } from "@/components/button";
import { Container } from "@/components/container";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Container className="py-20">
      <main id="main-content" className="max-w-xl">
        <h1 className="editorial text-4xl">A pause in the loop.</h1>
        <p role="alert" className="mt-5 text-muted">
          This page couldn’t load. Please try again.
        </p>
        <Button onClick={reset} className="mt-8">
          Try again
        </Button>
      </main>
    </Container>
  );
}
