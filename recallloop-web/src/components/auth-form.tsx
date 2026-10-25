"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/button";
import { authRequest } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const registering = mode === "register";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    try {
      await authRequest(
        mode,
        registering
          ? { ...credentials, name: String(form.get("name")).trim() }
          : credentials,
      );
      router.replace(registering ? "/login?registered=1" : "/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect. Please try again.",
      );
      setBusy(false);
    }
  }

  const inputStyle =
    "mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-dark placeholder:text-muted/60 transition-all focus:border-forest focus:outline-2 focus:outline-forest/30 shadow-2xs";

  return (
    <div className="min-h-screen w-full bg-surface flex flex-col lg:grid lg:grid-cols-12 overflow-x-hidden">
      {/* Meaningful Left Side (Editorial Showcase & Product Preview) */}
      <section
        aria-label="About RecallLoop"
        className="order-2 lg:order-1 lg:col-span-7 xl:col-span-7 bg-[#F7F7F8] border-t lg:border-t-0 lg:border-r border-black/[0.06] flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 relative overflow-hidden"
      >
        {/* Ambient background decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-forest/[0.04] blur-3xl"
        />

        {/* Top bar on desktop */}
        <div className="hidden lg:flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-dark transition-opacity hover:opacity-80"
          >
            <span className="text-forest text-xl" aria-hidden="true">↻</span>
            <span className="text-lg">RecallLoop</span>
          </Link>
          <span className="rounded-full bg-white border border-black/[0.06] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-forest shadow-2xs">
            Spaced Repetition & Recall
          </span>
        </div>

        {/* Core editorial storytelling */}
        <div className="my-auto py-8 sm:py-10 max-w-xl">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.2em] text-forest">
            Turning Reading Into Knowledge
          </span>
          <h2 className="editorial mt-3 text-3xl font-semibold tracking-tight text-dark sm:text-4xl lg:text-5xl leading-[1.12]">
            Never lose an important idea again.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed">
            Save any article, paper, or essay. Gemma extracts essential concepts into calibrated active recall flashcards, deterministically scheduled before forgetting begins.
          </p>

          {/* Living Product Mockup Card */}
          <div className="mt-8 rounded-2xl border border-black/[0.08] bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-forest animate-pulse" aria-hidden="true" />
                <span className="font-semibold uppercase tracking-wider text-forest">
                  Active Recall Preview
                </span>
              </div>
              <span className="text-muted text-[0.75rem]">Martin Kleppmann · DDIA</span>
            </div>

            <div className="mt-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-wider text-muted">
                Recall Question
              </p>
              <p className="mt-1 text-sm sm:text-base font-semibold tracking-tight text-dark">
                Why do distributed consensus systems append state changes to a Write-Ahead Log before updating memory?
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-forest/15 bg-sage/40 p-4">
              <div className="flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-wider text-forest">
                <span>Gemma-Extracted Concept</span>
                <span>Source Grounded</span>
              </div>
              <p className="mt-1.5 text-xs sm:text-sm text-dark/90 leading-relaxed">
                Sequential disk writes guarantee durability and deterministic crash recovery without risking state machine corruption during unexpected node outages.
              </p>
            </div>

            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted">Calibrated Leitner Rating</span>
                <span className="font-semibold text-forest">Next Review: 7 Days</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-muted">
                  Forgot (1d)
                </span>
                <span className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-muted">
                  Hard (3d)
                </span>
                <span className="rounded-lg border border-forest bg-forest px-3 py-1.5 text-xs font-semibold text-white shadow-2xs">
                  Easy (7d) ✓
                </span>
              </div>
            </div>
          </div>

          {/* 3 Core Value Pillars */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3.5 backdrop-blur-xs">
              <div className="text-forest text-sm font-semibold">01</div>
              <h3 className="mt-1 text-xs font-semibold text-dark">Source-Grounded</h3>
              <p className="mt-0.5 text-[0.75rem] text-muted leading-snug">
                Gemma extracts verified concepts directly from original text.
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3.5 backdrop-blur-xs">
              <div className="text-forest text-sm font-semibold">02</div>
              <h3 className="mt-1 text-xs font-semibold text-dark">Leitner Intervals</h3>
              <p className="mt-0.5 text-[0.75rem] text-muted leading-snug">
                1d → 3d → 7d → 14d spaced repetition schedules.
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/70 p-3.5 backdrop-blur-xs">
              <div className="text-forest text-sm font-semibold">03</div>
              <h3 className="mt-1 text-xs font-semibold text-dark">Zero Distraction</h3>
              <p className="mt-0.5 text-[0.75rem] text-muted leading-snug">
                No feeds or endless algorithms. Just focused retention.
              </p>
            </div>
          </div>
        </div>

        {/* Footer quote */}
        <div className="pt-6 border-t border-black/[0.06] flex items-center justify-between text-xs text-muted">
          <p className="italic max-w-md">
            “The mark of genuine learning isn’t how many tabs you keep open, but what you can effortlessly recall.”
          </p>
          <span className="hidden sm:inline font-mono text-[0.7rem] uppercase tracking-wider text-muted/70">
            Privacy First
          </span>
        </div>
      </section>

      {/* Form on Right Side */}
      <section
        aria-label={registering ? "Account Registration" : "Account Login"}
        className="order-1 lg:order-2 lg:col-span-5 xl:col-span-5 bg-white flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-10 xl:px-14 relative"
      >
        <main id="main-content" className="w-full max-w-md mx-auto">
          {/* Top navigation row */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-dark transition-opacity hover:opacity-80"
            >
              <span className="text-forest text-xl" aria-hidden="true">↻</span>
              <span>RecallLoop</span>
            </Link>
            <span className="rounded-full bg-surface border border-black/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {registering ? "Account Setup" : "Sign In"}
            </span>
          </div>

          <h1 className="editorial mt-8 text-3xl font-semibold tracking-tight text-dark sm:text-4xl">
            {registering ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {registering
              ? "Save it. Learn it. Remember it."
              : "Sign in to your personal learning companion."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" aria-busy={busy}>
            <fieldset disabled={busy} className="space-y-4">
              {registering && (
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Name
                  <input
                    name="name"
                    required
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Your name"
                    className={inputStyle}
                  />
                </label>
              )}
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  placeholder="name@example.com"
                  className={inputStyle}
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  aria-describedby={registering ? "password-hint" : undefined}
                  autoComplete={registering ? "new-password" : "current-password"}
                  placeholder="••••••••••••"
                  className={inputStyle}
                />
              </label>
              {registering && (
                <p id="password-hint" className="text-xs text-muted">
                  Must be between 12 and 128 characters.
                </p>
              )}
              {error && (
                <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
                  <p>{error}</p>
                </div>
              )}
              <div className="pt-2">
                <Button type="submit" disabled={busy} className="w-full min-h-12 text-base font-semibold shadow-md">
                  {busy
                    ? "Please wait…"
                    : registering
                      ? "Create account"
                      : "Log in"}
                </Button>
              </div>
            </fieldset>
          </form>

          <div className="mt-8 border-t border-black/[0.06] pt-6 text-center text-xs text-muted">
            {registering ? "Already have an account? " : "New to RecallLoop? "}
            <Link
              className="font-semibold text-forest underline underline-offset-4 hover:text-forest/80"
              href={registering ? "/login" : "/register"}
            >
              {registering ? "Log in" : "Create an account"}
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 text-[0.7rem] text-muted/80">
            <span>🔒 Encrypted session</span>
            <span>·</span>
            <span>⚡ Instant access</span>
            <span>·</span>
            <span>🛡 Privacy by design</span>
          </div>
        </main>
      </section>
    </div>
  );
}
