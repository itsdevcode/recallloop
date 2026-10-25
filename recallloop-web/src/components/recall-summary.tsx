"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import { reviewRequest, localDate, type ReviewStats } from "@/lib/reviews";

export function RecallSummary() {
  const router = useRouter();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    reviewRequest<ReviewStats>("stats")
      .then((value) => {
        if (active) setStats(value);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else setError("Unable to load recall progress.");
      });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  return (
    <section
      aria-label="Today's Recall"
      className="rounded-3xl border border-black/[0.06] bg-surface p-6 sm:p-9 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-forest">DAILY ACTIVE PRACTICE</p>
          <h2 className="editorial mt-1 text-2xl font-semibold tracking-tight text-dark sm:text-3xl">
            Today&apos;s Recall
          </h2>
        </div>
        {stats && stats.due_now > 0 && (
          <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">
            {stats.due_now} ready to review
          </span>
        )}
      </div>

      {error ? (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          <p>{error}</p>
          <Button
            className="mt-3 min-h-10 text-xs"
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Retry recall progress
          </Button>
        </div>
      ) : !stats ? (
        <div role="status" className="skeleton mt-6 p-8">
          <p className="text-sm text-muted">Loading recall progress…</p>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="rounded-2xl border border-black/[0.05] bg-white p-5 shadow-2xs">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Cards due now</dt>
              <dd className="mt-2 text-4xl font-semibold tracking-tight text-dark">{stats.due_now}</dd>
            </div>
            <div className="rounded-2xl border border-black/[0.05] bg-white p-5 shadow-2xs">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                Reviews completed today (UTC)
              </dt>
              <dd className="mt-2 text-4xl font-semibold tracking-tight text-dark">
                {stats.reviewed_today}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            {stats.due_now > 0 ? (
              <Link
                href="/dashboard/review"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-forest px-8 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-forest/90 active:scale-[0.98] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-forest"
              >
                Start Recall
              </Link>
            ) : (
              <p className="text-sm text-muted">
                {stats.next_review_at
                  ? `You're all caught up. Next review: ${localDate(stats.next_review_at)}.`
                  : stats.total_cards
                    ? "You're all caught up. No upcoming reviews are scheduled."
                    : "Your recall queue is empty. Save an article to create your first cards."}
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2">
            <div>
              <h3 className="eyebrow text-muted">Progress Summary</h3>
              <p className="mt-1.5 text-sm font-medium text-dark/80">
                {stats.total_cards} cards · {stats.total_completed_reviews} completed reviews
              </p>
            </div>
            <div>
              <h3 className="eyebrow text-muted">Upcoming Reviews</h3>
              <p className="mt-1.5 text-sm font-medium text-dark/80">
                {stats.upcoming_next_7_days} scheduled in the next 7 UTC dates
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
