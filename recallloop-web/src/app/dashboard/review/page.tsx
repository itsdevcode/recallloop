"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import {
  reviewRequest,
  localDate,
  type DueCard,
  type DuePage,
  type Rating,
  type ReviewResult,
} from "@/lib/reviews";

const labels: Record<Rating, string> = {
  FORGOT: "Forgot",
  HARD: "Hard",
  EASY: "Easy",
};

export default function ReviewPage() {
  const router = useRouter();
  const [page, setPage] = useState<DuePage | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState<Record<Rating, number>>({
    FORGOT: 0,
    HARD: 0,
    EASY: 0,
  });
  const [confirmation, setConfirmation] = useState("");

  function restart() {
    setPage(null);
    setIndex(0);
    setCounts({ FORGOT: 0, HARD: 0, EASY: 0 });
    setError("");
    setConfirmation("");
    setAttempt((v) => v + 1);
  }

  useEffect(() => {
    let active = true;
    reviewRequest<DuePage>("due?limit=50")
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else setError("Unable to load your due cards.");
      });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  function reviewed(result: ReviewResult) {
    setCounts((values) => ({
      ...values,
      [result.rating]: values[result.rating] + 1,
    }));
    setConfirmation(
      `${labels[result.rating]} saved. Next review: ${localDate(result.next_review_at)}.`,
    );
    setIndex((value) => value + 1);
  }

  return (
    <section className="mx-auto max-w-2xl py-4">
      <div>
        <span className="eyebrow text-forest">ACTIVE RECALL</span>
        <h1 className="editorial mt-1 text-3xl font-semibold tracking-tight text-dark sm:text-4xl">
          Today&apos;s Recall
        </h1>
        <p className="mt-2 text-sm text-muted">
          Try answering from memory before revealing the answer.
        </p>
      </div>

      {confirmation && (
        <div role="status" className="mt-5 rounded-2xl bg-sage/70 border border-sage-dark p-4 text-xs font-semibold text-forest shadow-2xs">
          <p>{confirmation}</p>
        </div>
      )}

      {error ? (
        <div role="alert" className="mt-6 rounded-3xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          <p>{error}</p>
          <Button className="mt-4 min-h-10 text-xs" onClick={restart}>
            Retry due cards
          </Button>
        </div>
      ) : !page ? (
        <div role="status" className="skeleton mt-8 p-10 text-center">
          <p className="text-sm font-medium text-muted">Loading due cards…</p>
        </div>
      ) : page.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-black/[0.06] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage text-forest font-bold mb-4">
            ✓
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-dark">No cards due right now</h2>
          <p className="mt-2 text-sm text-muted">You have reviewed all scheduled cards for today.</p>
          <Link href="/dashboard" className="mt-6 inline-flex text-sm font-semibold text-forest underline underline-offset-4">
            Return to dashboard
          </Link>
        </div>
      ) : index < page.items.length ? (
        <>
          <div className="mt-8 flex items-center justify-between text-xs text-muted">
            <p aria-live="polite" className="font-medium">
              Reviewed {index} of {page.items.length} in this batch
              {page.total_due > page.items.length
                ? ` · ${page.total_due} cards were due at the start`
                : ""}
            </p>
            <span className="font-semibold text-forest">
              {Math.round((index / page.items.length) * 100)}%
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <progress
              value={index}
              max={page.items.length}
              aria-label="Session progress"
              className="h-full w-full accent-forest"
            />
          </div>

          <QuestionReview
            key={page.items[index].card_id}
            card={page.items[index]}
            onReviewed={reviewed}
            onRestart={restart}
          />
        </>
      ) : (
        <Completion counts={counts} onRestart={restart} />
      )}
    </section>
  );
}

function QuestionReview({
  card,
  onReviewed,
  onRestart,
}: {
  card: DueCard;
  onReviewed: (value: ReviewResult) => void;
  onRestart: () => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<{
    rating: Rating;
    key: string;
  } | null>(null);
  const inFlight = useRef(false);
  const submission = useRef<{ rating: Rating; key: string } | null>(null);

  async function reveal() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      setAnswer(
        (
          await reviewRequest<{ answer: string }>(
            `cards/${card.card_id}/answer`,
          )
        ).answer,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace("/login");
      else {
        setError(
          "Unable to reveal the answer. Try again or reload the due queue.",
        );
        if (error instanceof ApiError && error.status === 404)
          setConflict(true);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function rate(rating: Rating) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const request = submission.current ?? { rating, key: crypto.randomUUID() };
    submission.current = request;
    setPending(request);
    try {
      onReviewed(
        await reviewRequest<ReviewResult>(
          `cards/${card.card_id}`,
          { rating: request.rating },
          request.key,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace("/login");
      else if (error instanceof ApiError && [404, 409].includes(error.status)) {
        setConflict(true);
        setError(
          "This card changed or was reviewed elsewhere. Reload the due queue; saved reviews remain in history.",
        );
      } else
        setError(
          "We couldn't confirm the review was saved. Retry saving with the same request key.",
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className="mt-6 rounded-3xl border border-black/[0.06] bg-white p-7 sm:p-10 shadow-md"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-wider text-forest">
          {card.concept_title}
        </span>
        <span className="truncate max-w-[240px]">
          {card.article_title || "Saved article"}
        </span>
      </div>

      <h2 className="editorial mt-6 break-words text-2xl font-semibold tracking-tight text-dark sm:text-3xl leading-snug">
        {card.question}
      </h2>

      {answer === null ? (
        <div className="mt-8 pt-4 border-t border-black/[0.06]">
          <Button
            className="min-h-12 px-8 text-sm font-semibold shadow-sm"
            disabled={busy || conflict}
            onClick={reveal}
          >
            {busy ? "Loading answer…" : "Show Answer"}
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-6 pt-4 border-t border-black/[0.06]">
          <div
            className="whitespace-pre-wrap break-words rounded-2xl bg-sage/60 border border-sage-dark p-6 text-base leading-relaxed text-dark shadow-2xs"
            aria-label="Answer"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-forest mb-2">Answer</p>
            {answer}
          </div>

          {!pending && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                How well did you recall this?
              </p>
              <div
                className="flex flex-wrap gap-3"
                role="group"
                aria-label="Rate your recall"
              >
                {(["FORGOT", "HARD", "EASY"] as Rating[]).map((rating) => {
                  let style = "";
                  if (rating === "FORGOT") {
                    style =
                      "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
                  } else if (rating === "HARD") {
                    style =
                      "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
                  } else {
                    style = "bg-forest text-white hover:bg-forest/90 shadow-sm";
                  }
                  return (
                    <button
                      key={rating}
                      disabled={busy}
                      onClick={() => void rate(rating)}
                      className={`inline-flex min-h-11 items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold tracking-tight transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${style}`}
                    >
                      {labels[rating]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {busy && pending && (
        <p role="status" className="mt-4 text-xs font-medium text-muted">
          Saving review…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-800">
          <p>{error}</p>
          {pending && !conflict && (
            <Button
              className="mt-3 min-h-9 px-4 text-xs"
              disabled={busy}
              onClick={() => void rate(pending.rating)}
            >
              Retry saving review
            </Button>
          )}
        </div>
      )}

      {conflict && (
        <Button className="mt-4 min-h-10 text-xs" onClick={onRestart}>
          Reload due queue
        </Button>
      )}
    </div>
  );
}

function Completion({
  counts,
  onRestart,
}: {
  counts: Record<Rating, number>;
  onRestart: () => void;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    reviewRequest<DuePage>("due?limit=1")
      .then((value) => {
        if (active) setRemaining(value.total_due);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, router]);

  return (
    <div className="mt-8 rounded-3xl border border-black/[0.06] bg-white p-8 sm:p-10 shadow-sm text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage text-forest text-2xl font-bold mb-4">
        ✓
      </div>
      <h2 className="editorial text-3xl font-semibold tracking-tight text-dark">Recall batch complete</h2>
      <p className="mt-2 text-sm text-muted">
        Total reviewed: {counts.FORGOT + counts.HARD + counts.EASY}
      </p>

      <dl className="mt-6 flex flex-wrap justify-center gap-4 sm:gap-6">
        {(["FORGOT", "HARD", "EASY"] as Rating[]).map((rating) => (
          <div key={rating} className="rounded-2xl border border-black/[0.06] bg-surface px-6 py-4 min-w-[90px]">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{labels[rating]}</dt>
            <dd className="mt-1 text-2xl font-semibold text-dark">{counts[rating]}</dd>
          </div>
        ))}
      </dl>

      {error ? (
        <div className="mt-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-medium text-red-800">
          <p role="alert">
            Your batch is saved, but we couldn&apos;t check the remaining queue.
          </p>
          <Button
            className="mt-3 min-h-9 px-4 text-xs"
            onClick={() => {
              setError(false);
              setAttempt((v) => v + 1);
            }}
          >
            Check due cards
          </Button>
        </div>
      ) : remaining === null ? (
        <p role="status" className="mt-6 text-sm text-muted">
          Checking remaining due cards…
        </p>
      ) : remaining > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium text-dark">{remaining} cards are still due.</p>
          <Button className="min-h-12 px-8 font-semibold shadow-sm" onClick={onRestart}>
            Start next batch
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm font-medium text-forest">You&apos;re all caught up for now.</p>
      )}

      <div className="mt-8 border-t border-black/[0.06] pt-6">
        <Link href="/dashboard" className="text-xs font-semibold text-muted underline underline-offset-4 hover:text-dark">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
