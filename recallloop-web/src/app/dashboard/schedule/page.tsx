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
    <>
      <h1 className="text-3xl font-semibold">Review Schedule</h1>
      <p className="mt-3 text-muted">
        Calendar groups use UTC. Exact review times below use your local
        timezone.
      </p>
      {error && (
        <div role="alert" className="mt-5">
          <p>{error}</p>
          <Button
            className="mt-4"
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
        <p role="status" className="mt-8">
          Loading your review schedule…
        </p>
      ) : (
        <>
          <dl className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-forest/15 bg-sage/50 p-5">
              <dt>Overdue from earlier UTC dates</dt>
              <dd className="mt-2 text-3xl font-semibold">
                {schedule.overdue}
              </dd>
            </div>
            <div className="rounded-2xl border border-forest/15 bg-white/50 p-5">
              <dt>Due today so far (UTC)</dt>
              <dd className="mt-2 text-3xl font-semibold">
                {schedule.due_today}
              </dd>
            </div>
          </dl>
          <h2 className="mt-9 text-xl font-semibold">
            Upcoming reviews · next 7 UTC dates
          </h2>
          <p className="mt-2 text-sm text-muted">
            Future cards only; overdue and currently due cards are counted
            above.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {schedule.upcoming.map((day) => (
              <li
                key={day.date}
                className="rounded-xl border border-forest/15 p-4"
              >
                <p className="text-sm text-muted">
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                    undefined,
                    { timeZone: "UTC", month: "short", day: "numeric" },
                  )}
                </p>
                <p className="mt-2 text-2xl font-semibold">{day.count}</p>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 text-xl font-semibold">
            Review history ({history.total})
          </h2>
          {history.items.length === 0 ? (
            <p className="mt-4 text-muted">
              No reviews yet. Your completed reviews will appear here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {history.items.map((log) => (
                <li
                  key={log.id}
                  className="rounded-2xl border border-forest/15 bg-white/50 p-5"
                >
                  <p className="text-xs text-muted">
                    {log.article_title || "Saved article"} · {log.rating}
                  </p>
                  <h3 className="mt-2 break-words font-semibold">
                    {log.question}
                  </h3>
                  <p className="mt-3 text-sm text-muted">
                    Reviewed {localDate(log.reviewed_at)} · Next review{" "}
                    {localDate(log.next_review_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {history.items.length < history.total && (
            <Button className="mt-6" disabled={busy} onClick={moreHistory}>
              {busy ? "Loading…" : "Load more history"}
            </Button>
          )}
        </>
      )}
    </>
  );
}
