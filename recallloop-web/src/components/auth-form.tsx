"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
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
    <div className="min-h-screen bg-surface py-12 sm:py-20 flex items-center justify-center">
      <Container className="max-w-md">
        <main
          id="main-content"
          className="rounded-3xl border border-black/[0.06] bg-white p-7 sm:p-10 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-semibold tracking-tight text-dark transition-opacity hover:opacity-80"
            >
              <span className="text-forest text-lg" aria-hidden="true">↻</span>
              <span>RecallLoop</span>
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
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
        </main>
      </Container>
    </div>
  );
}
