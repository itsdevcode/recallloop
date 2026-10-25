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
    "mt-2 w-full rounded-xl border border-forest/25 bg-white px-4 py-3 text-forest focus:outline-2 focus:outline-forest";
  return (
    <Container className="py-12 sm:py-20">
      <div className="mx-auto max-w-md">
        <Link href="/" className="font-semibold">
          RecallLoop
        </Link>
        <h1 className="mt-10 text-3xl font-semibold">
          {registering ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-muted">
          {registering
            ? "Save it. Learn it. Remember it."
            : "Sign in to your learning companion."}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-5">
            {registering && (
              <label className="block text-sm font-medium">
                Name
                <input
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={inputStyle}
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                className={inputStyle}
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                name="password"
                type="password"
                required
                minLength={registering ? 12 : 1}
                maxLength={128}
                aria-describedby={registering ? "password-hint" : undefined}
                autoComplete={registering ? "new-password" : "current-password"}
                className={inputStyle}
              />
            </label>
            {registering && (
              <p id="password-hint" className="text-sm text-muted">
                Use 12–128 characters.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy
                ? "Please wait…"
                : registering
                  ? "Create account"
                  : "Log in"}
            </Button>
          </fieldset>
        </form>
        <p className="mt-6 text-sm text-muted">
          {registering ? "Already have an account? " : "New to RecallLoop? "}
          <Link
            className="font-semibold text-forest underline"
            href={registering ? "/login" : "/register"}
          >
            {registering ? "Log in" : "Create an account"}
          </Link>
        </p>
      </div>
    </Container>
  );
}
