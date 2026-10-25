"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import {
  reviewRequest,
  localDate,
  type HistoryPage,
  type ReviewSchedule,
} from "@/lib/reviews";

export default function SchedulePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ReviewSchedule | null>(null);
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      reviewRequest<ReviewSchedule>("schedule"),
      reviewRequest<HistoryPage>("history?limit=20&offset=0"),
    ])
      .then(([schedule, history]) => {
        if (active) {
          setSchedule(schedule);
          setHistory(history);
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else setError("Unable to load your schedule and history.");
      });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  async function moreHistory() {
    if (!history) return;
    setBusy(true);
    setError("");
    try {
      const next = await reviewRequest<HistoryPage>(
        `history?limit=20&offset=${history.items.length}`,
      );
      setHistory({ ...next, items: [...history.items, ...next.items] });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace("/login");
      else setError("Unable to load more history. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      <div>
        <span className="eyebrow text-forest">SPACED REPETITION ENGINE</span>
        <h1 className="editorial mt-1 text-3xl font-semibold tracking-tight text-dark sm:text-4xl">
          Review Schedule
        </h1>
        <p className="mt-2 text-sm text-muted">
          Calendar groups use UTC. Exact review times below use your local timezone.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-3xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          <p>{error}</p>
          <Button
            className="mt-4 min-h-10 text-xs"
            onClick={() => {
              setError("");
              setAttempt((v) => v + 1);
            }}
          >
            Retry schedule
          </Button>
        </div>
      )}

      {!schedule || !history ? (
        <div role="status" className="skeleton p-12 text-center text-sm text-muted">
          <p>Loading your review schedule…</p>
        </div>
      ) : (
        <>
          {/* Quick Metrics */}
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-black/[0.06] bg-surface p-6 shadow-2xs">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Overdue from earlier UTC dates</dt>
              <dd className="mt-2 text-4xl font-semibold tracking-tight text-dark">
                {schedule.overdue}
              </dd>
            </div>
            <div className="rounded-3xl border border-black/[0.06] bg-surface p-6 shadow-2xs">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Due today so far (UTC)</dt>
              <dd className="mt-2 text-4xl font-semibold tracking-tight text-dark">
                {schedule.due_today}
              </dd>
            </div>
          </dl>

          {/* 7-day Upcoming Grid */}
          <section className="rounded-3xl border border-black/[0.06] bg-surface p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-semibold tracking-tight text-dark">
              Upcoming reviews · next 7 UTC dates
            </h2>
            <p className="mt-1 text-xs text-muted">
              Future cards only; overdue and currently due cards are counted above.
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {schedule.upcoming.map((day) => (
                <li
                  key={day.date}
                  className="rounded-2xl border border-black/[0.06] bg-white p-4 text-center transition-all hover:shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                      undefined,
                      { timeZone: "UTC", month: "short", day: "numeric" },
                    )}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-dark">{day.count}</p>
                  <span className="text-[0.65rem] text-muted">cards</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Review History */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight text-dark">
              Review history ({history.total})
            </h2>

            {history.items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-muted">
                No reviews yet. Your completed reviews will appear here.
              </div>
            ) : (
              <ul className="space-y-3">
                {history.items.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 transition-all hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span className="font-medium text-dark/70">
                        {log.article_title || "Saved article"}
                      </span>
                      <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-forest">
                        {log.rating}
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-base font-semibold text-dark">
                      {log.question}
                    </h3>
                    <p className="mt-3 text-xs text-muted">
                      Reviewed {localDate(log.reviewed_at)} · Next review{" "}
                      {localDate(log.next_review_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {history.items.length < history.total && (
              <div className="pt-2 text-center">
                <Button className="min-h-11 px-8 text-xs font-semibold" disabled={busy} onClick={moreHistory}>
                  {busy ? "Loading…" : "Load more history"}
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
