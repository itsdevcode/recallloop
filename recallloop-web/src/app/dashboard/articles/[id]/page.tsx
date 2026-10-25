"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import {
  articleRequest,
  type Article,
  type ArticleDetail,
  type Concept,
} from "@/lib/articles";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  return <ArticleView key={id} id={id} />;
}

function ArticleView({ id }: { id: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    async function refresh() {
      try {
        if (document.visibilityState !== "visible") {
          timer = setTimeout(refresh, 3000);
          return;
        }
        const value = await articleRequest<ArticleDetail>(`/${id}`);
        const learning =
          value.status === "READY"
            ? await articleRequest<Concept[]>(`/${id}/concepts`)
            : [];
        if (!active) return;
        setArticle(value);
        setConcepts(learning);
        if (value.status === "PENDING" || value.status === "PROCESSING") {
          if (++count < 100) timer = setTimeout(refresh, 3000);
          else setPaused(true);
        }
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load the article.",
          );
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, attempt, router]);

  async function retry() {
    setBusy(true);
    setError("");
    try {
      const value = await articleRequest<Article>(`/${id}/retry`, "POST", {});
      setArticle((previous) => (previous ? { ...previous, ...value } : null));
      setConcepts([]);
      setPaused(false);
      setAttempt((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        router.replace("/login");
      else
        setError(
          error instanceof Error
            ? error.message
            : "Unable to retry processing.",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 py-2">
      <Link
        href="/dashboard/articles"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-dark transition-colors"
      >
        <span>←</span> Back to library
      </Link>

      {error && (
        <div role="alert" className="rounded-3xl bg-red-50 border border-red-200 p-6 text-sm text-red-800">
          <p>{error}</p>
          <Button
            className="mt-4 min-h-10 text-xs"
            onClick={() => {
              setError("");
              setPaused(false);
              setAttempt((v) => v + 1);
            }}
          >
            Refresh status
          </Button>
        </div>
      )}

      {!article ? (
        <div role="status" className="skeleton p-12 text-center text-sm text-muted">
          <p>Loading article…</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-semibold text-forest">
                {article.source || new URL(article.url).hostname}
              </span>
              <span>·</span>
              <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-forest">
                {article.status}
              </span>
            </div>

            <h1 className="editorial break-words text-3xl font-semibold tracking-tight text-dark sm:text-4xl lg:text-5xl">
              {article.title || "Saved article"}
            </h1>

            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-forest underline underline-offset-4 hover:text-forest/80"
            >
              Read original article ↗
            </a>
          </div>

          {(article.status === "PENDING" || article.status === "PROCESSING") && (
            <div role="status" className="rounded-2xl bg-surface border border-black/[0.06] p-5 text-sm text-muted">
              {article.status === "PENDING"
                ? "Queued for processing."
                : "Reading the article and preparing your learning material…"}
            </div>
          )}

          {paused && (
            <Button
              className="mt-4 min-h-10 text-xs"
              onClick={() => {
                setPaused(false);
                setAttempt((v) => v + 1);
              }}
            >
              Refresh status
            </Button>
          )}

          {article.error_message && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-sm text-red-800">
              <p>{article.error_message}</p>
            </div>
          )}

          {article.status === "FAILED" && article.processing_attempts < 3 && (
            <Button className="min-h-11 px-6 text-xs font-semibold shadow-sm" disabled={busy} onClick={retry}>
              {busy ? "Queuing…" : "Retry processing"}
            </Button>
          )}

          {concepts.length > 0 && (
            <section className="space-y-6 pt-4 border-t border-black/[0.08]" aria-label="Learning material">
              <div>
                <span className="eyebrow text-forest">SYNTHESIZED KNOWLEDGE</span>
                <h2 className="editorial mt-1 text-2xl font-semibold tracking-tight text-dark sm:text-3xl">
                  Key ideas & recall questions
                </h2>
                <p className="mt-1.5 text-xs text-muted">
                  Generated by Gemma. Check the supporting passages for context.
                </p>
                {article.processing_note && (
                  <p className="mt-1 text-xs text-muted italic">
                    {article.processing_note}
                  </p>
                )}
              </div>

              <div className="space-y-5">
                {concepts.map((concept) => (
                  <section
                    key={concept.id}
                    className="rounded-3xl border border-black/[0.06] bg-white p-6 sm:p-8 shadow-sm space-y-4"
                  >
                    <h3 className="text-xl font-semibold tracking-tight text-dark">{concept.title}</h3>
                    <p className="text-sm leading-relaxed text-dark/90">
                      {concept.explanation}
                    </p>
                    <blockquote className="rounded-xl bg-surface p-4 border-l-3 border-forest text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-dark/70 block mb-1">Source excerpt:</span>
                      &ldquo;{concept.source_excerpt}&rdquo;
                    </blockquote>
                    {concept.cards.map((card) => (
                      <div
                        key={card.id}
                        className="border-t border-black/[0.06] pt-4"
                      >
                        <p className="text-sm font-semibold text-dark">{card.question}</p>
                        <details className="mt-2.5 group">
                          <summary className="cursor-pointer text-xs font-semibold text-forest underline underline-offset-2">
                            Reveal answer
                          </summary>
                          <div className="mt-2.5 rounded-xl bg-sage/50 p-4 text-xs leading-relaxed text-dark border border-sage-dark">
                            {card.answer}
                          </div>
                        </details>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </section>
          )}

          {article.content && (
            <section className="space-y-4 pt-6 border-t border-black/[0.08]">
              <h2 className="text-xl font-semibold tracking-tight text-dark">Article text</h2>
              <div className="rounded-3xl border border-black/[0.06] bg-surface p-6 sm:p-8 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {article.content}
              </div>
            </section>
          )}

          <div className="border-t border-black/[0.08] pt-6 text-sm text-muted">
            {article.status === "READY" ? (
              <p>
                Your cards are ready for active recall.{" "}
                <Link
                  href="/dashboard/review"
                  className="font-semibold text-forest underline underline-offset-4"
                >
                  Start Recall
                </Link>
              </p>
            ) : (
              <p>Recall cards will be available after successful processing.</p>
            )}
          </div>
        </>
      )}
    </article>
  );
}
