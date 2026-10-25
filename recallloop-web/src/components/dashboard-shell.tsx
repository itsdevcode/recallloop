"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { ApiError, authRequest, type PublicUser } from "@/lib/auth";

const UserContext = createContext<PublicUser | null>(null);
export function useUser() {
  return useContext(UserContext)!;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
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
    <Container className="py-8 sm:py-12">
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
        <UserContext.Provider value={user}>
          <header className="mb-10 flex flex-wrap items-center justify-between gap-5 border-b border-forest/15 pb-6">
            <Link href="/dashboard" className="text-lg font-semibold">
              RecallLoop
            </Link>
            <nav
              className="flex w-full flex-wrap items-center gap-4 text-sm sm:w-auto"
              aria-label="Dashboard"
            >
              {[
                ["/dashboard", "Home"],
                ["/dashboard/articles", "My Library"],
                ["/dashboard/review", "Today's Recall"],
                ["/dashboard/schedule", "Review Schedule"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="underline underline-offset-4"
                >
                  {label}
                </Link>
              ))}
              <Button onClick={logout} disabled={busy}>
                {busy ? "Logging out…" : "Log out"}
              </Button>
            </nav>
          </header>
          {error && (
            <p role="alert" className="mb-6 text-red-800">
              {error}
            </p>
          )}
          {children}
        </UserContext.Provider>
      )}
    </Container>
  );
}
