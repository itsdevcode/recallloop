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
      className="mt-8 rounded-3xl border border-forest/15 bg-sage/60 p-6 sm:p-9"
    >
      <p className="eyebrow mb-3">Your daily practice</p>
      <h2 className="editorial text-3xl">Today&apos;s Recall</h2>
      {error ? (
        <div role="alert" className="mt-4">
          <p>{error}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Retry recall progress
          </Button>
        </div>
      ) : !stats ? (
        <p role="status" className="skeleton mt-4 p-5">
          Loading recall progress…
        </p>
      ) : (
        <>
          <dl className="mt-5 flex flex-wrap gap-8">
            <div>
              <dt className="text-sm text-muted">Cards due now</dt>
              <dd className="mt-1 text-3xl font-semibold">{stats.due_now}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">
                Reviews completed today (UTC)
              </dt>
              <dd className="mt-1 text-3xl font-semibold">
                {stats.reviewed_today}
              </dd>
            </div>
          </dl>
          {stats.due_now > 0 ? (
            <Link
              href="/dashboard/review"
              className="mt-6 inline-flex min-h-12 items-center rounded-full bg-forest px-7 py-3 font-semibold text-ivory focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Start Recall
            </Link>
          ) : (
            <p className="mt-5 text-muted">
              {stats.next_review_at
                ? `You're all caught up. Next review: ${localDate(stats.next_review_at)}.`
                : stats.total_cards
                  ? "You're all caught up. No upcoming reviews are scheduled."
                  : "Your recall queue is empty. Save an article to create your first cards."}
            </p>
          )}
          <div className="mt-7 grid gap-5 border-t border-forest/15 pt-6 sm:grid-cols-2">
            <div>
              <h3 className="eyebrow">Progress Summary</h3>
              <p className="mt-2 text-sm text-muted">
                {stats.total_cards} cards · {stats.total_completed_reviews}{" "}
                completed reviews
              </p>
            </div>
            <div>
              <h3 className="eyebrow">Upcoming Reviews</h3>
              <p className="mt-2 text-sm text-muted">
                {stats.upcoming_next_7_days} scheduled in the next 7 UTC dates
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/schedule"
            className="mt-5 block text-sm font-medium underline"
          >
            View review schedule and history
          </Link>
        </>
      )}
    </section>
  );
}
