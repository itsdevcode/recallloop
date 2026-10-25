"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { ApiError, authRequest, type PublicUser } from "@/lib/auth";

const UserContext = createContext<PublicUser | null>(null);
export function useUser() {
  return useContext(UserContext)!;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
    <div className="min-h-screen bg-surface/50 text-dark selection:bg-sage selection:text-forest">
      <Container className="workspace py-6 sm:py-10">
        {!user ? (
          <div aria-live="polite" className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="skeleton h-12 w-12 rounded-full mb-4" />
            <p className="text-sm font-medium text-muted">{error || "Checking your session…"}</p>
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
            <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.08] pb-5 sm:mb-12">
              <Link href="/dashboard" className="flex items-center gap-2 text-base font-semibold tracking-tight text-dark">
                <span className="text-forest text-lg" aria-hidden="true">↻</span>
                <span>RecallLoop</span>
              </Link>
              <nav
                className="workspace-nav flex w-full flex-wrap items-center gap-1.5 text-xs font-medium sm:w-auto sm:text-sm"
                aria-label="Dashboard"
              >
                {[
                  ["/dashboard", "Home"],
                  ["/dashboard/articles", "My Library"],
                  ["/dashboard/review", "Today's Recall"],
                  ["/dashboard/schedule", "Review Schedule"],
                ].map(([href, label]) => {
                  const isCurrent =
                    pathname === href ||
                    (href === "/dashboard/articles" && pathname.startsWith(`${href}/`));
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`rounded-full px-3.5 py-1.5 transition-all duration-150 ${
                        isCurrent
                          ? "bg-sage font-semibold text-forest shadow-2xs"
                          : "text-muted hover:bg-black/[0.04] hover:text-dark"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
                <Button
                  onClick={logout}
                  disabled={busy}
                  className="ml-auto min-h-9 px-4 py-1.5 text-xs font-semibold sm:ml-2 bg-transparent text-muted hover:bg-black/[0.05] hover:text-dark border border-black/10 shadow-none"
                >
                  {busy ? "Logging out…" : "Log out"}
                </Button>
              </nav>
            </header>
            {error && (
              <div role="alert" className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                <p>{error}</p>
              </div>
            )}
            <main id="main-content">{children}</main>
          </UserContext.Provider>
        )}
      </Container>
    </div>
  );
}
