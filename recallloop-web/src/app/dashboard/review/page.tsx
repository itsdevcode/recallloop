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
    <section className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold">Today&apos;s Recall</h1>
      <p className="mt-3 text-muted">
        Try answering from memory before revealing the answer.
      </p>
      {confirmation && (
        <p role="status" className="mt-5 rounded-xl bg-sage p-4">
          {confirmation}
        </p>
      )}
      {error ? (
        <div role="alert" className="mt-6">
          <p>{error}</p>
          <Button className="mt-4" onClick={restart}>
            Retry due cards
          </Button>
        </div>
      ) : !page ? (
        <p role="status" className="mt-8">
          Loading due cards…
        </p>
      ) : page.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-forest/15 p-6">
          <h2 className="text-xl font-semibold">No cards due right now</h2>
          <Link href="/dashboard" className="mt-4 inline-block underline">
            Return to dashboard
          </Link>
        </div>
      ) : index < page.items.length ? (
        <>
          <p className="mt-6 text-sm text-muted" aria-live="polite">
            Reviewed {index} of {page.items.length} in this batch
            {page.total_due > page.items.length
              ? ` · ${page.total_due} cards were due at the start`
              : ""}
          </p>
          <progress
            value={index}
            max={page.items.length}
            aria-label="Session progress"
            className="mt-3 h-2 w-full accent-forest"
          />
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
      className="mt-6 rounded-2xl border border-forest/15 bg-white/60 p-6 sm:p-8"
      aria-busy={busy}
    >
      <p className="text-sm text-muted">
        {card.article_title || "Saved article"} · {card.concept_title}
      </p>
      <h2 className="mt-5 break-words text-2xl leading-relaxed font-semibold">
        {card.question}
      </h2>
      {answer === null ? (
        <Button className="mt-7" disabled={busy || conflict} onClick={reveal}>
          {busy ? "Loading answer…" : "Show Answer"}
        </Button>
      ) : (
        <>
          <div
            className="mt-6 whitespace-pre-wrap break-words rounded-xl bg-sage/50 p-5"
            aria-label="Answer"
          >
            {answer}
          </div>
          {!pending && (
            <div
              className="mt-6 flex flex-wrap gap-3"
              role="group"
              aria-label="Rate your recall"
            >
              {(["FORGOT", "HARD", "EASY"] as Rating[]).map((rating) => (
                <Button
                  key={rating}
                  disabled={busy}
                  onClick={() => void rate(rating)}
                >
                  {labels[rating]}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      {busy && pending && (
        <p role="status" className="mt-4 text-sm">
          Saving review…
        </p>
      )}
      {error && (
        <div role="alert" className="mt-5 text-red-800">
          <p>{error}</p>
          {pending && !conflict && (
            <Button
              className="mt-4"
              disabled={busy}
              onClick={() => void rate(pending.rating)}
            >
              Retry saving review
            </Button>
          )}
        </div>
      )}
      {conflict && (
        <Button className="mt-4" onClick={onRestart}>
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
    <div className="mt-8 rounded-2xl border border-forest/15 bg-sage/40 p-6">
      <h2 className="text-2xl font-semibold">Recall batch complete</h2>
      <p className="mt-3">
        Total reviewed: {counts.FORGOT + counts.HARD + counts.EASY}
      </p>
      <dl className="mt-4 flex flex-wrap gap-6">
        {(["FORGOT", "HARD", "EASY"] as Rating[]).map((rating) => (
          <div key={rating}>
            <dt>{labels[rating]}</dt>
            <dd className="text-xl font-semibold">{counts[rating]}</dd>
          </div>
        ))}
      </dl>
      {error ? (
        <>
          <p role="alert" className="mt-5">
            Your batch is saved, but we couldn&apos;t check the remaining queue.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setError(false);
              setAttempt((v) => v + 1);
            }}
          >
            Check due cards
          </Button>
        </>
      ) : remaining === null ? (
        <p role="status" className="mt-5">
          Checking remaining due cards…
        </p>
      ) : remaining > 0 ? (
        <>
          <p className="mt-5">{remaining} cards are still due.</p>
          <Button className="mt-4" onClick={onRestart}>
            Start next batch
          </Button>
        </>
      ) : (
        <p className="mt-5">You&apos;re all caught up for now.</p>
      )}
      <Link href="/dashboard" className="mt-6 block underline">
        Return to dashboard
      </Link>
    </div>
  );
}
