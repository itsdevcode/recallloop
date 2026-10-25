"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { ApiError, authRequest, type PublicUser } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    authRequest<PublicUser>("me")
      .then((profile) => {
        if (active) setUser(profile);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else setError("Unable to load your profile. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [router, attempt]);

  async function logout() {
    setBusy(true);
    setError("");
    try {
      await authRequest("logout", {});
      setUser(null);
      router.replace("/login");
    } catch {
      setError("Unable to log out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Container className="py-16">
      {!user ? (
        <div aria-live="polite">
          <p>{error || "Checking your session…"}</p>
          {error && (
            <Button
              className="mt-4"
              onClick={() => {
                setError("");
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </Button>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          <p className="font-semibold">RecallLoop</p>
          <h1 className="mt-8 text-3xl font-semibold">Welcome, {user.name}.</h1>
          <p className="mt-4 text-muted">
            Your learning space is taking shape. Article saving and reviews are
            coming next.
          </p>
          <Button className="mt-8" onClick={logout} disabled={busy}>
            {busy ? "Logging out…" : "Log out"}
          </Button>
          {error && (
            <p role="alert" className="mt-4 text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </Container>
  );
}
