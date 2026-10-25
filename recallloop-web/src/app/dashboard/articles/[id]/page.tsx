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
    <article className="mx-auto max-w-3xl">
      <Link href="/dashboard/articles" className="text-sm underline">
        Back to library
      </Link>
      {error && (
        <div role="alert" className="mt-6">
          <p>{error}</p>
          <Button
            className="mt-4"
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
        <p role="status" className="mt-8">
          Loading article…
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted">
            {article.source || new URL(article.url).hostname} ·{" "}
            <span>{article.status}</span>
          </p>
          <h1 className="mt-3 break-words text-3xl font-semibold">
            {article.title || "Saved article"}
          </h1>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block underline"
          >
            Read original article ↗
          </a>
          {(article.status === "PENDING" ||
            article.status === "PROCESSING") && (
            <p role="status" className="mt-6 rounded-xl bg-sage p-5">
              {article.status === "PENDING"
                ? "Queued for processing."
                : "Reading the article and preparing your learning material…"}
            </p>
          )}
          {paused && (
            <Button
              className="mt-4"
              onClick={() => {
                setPaused(false);
                setAttempt((v) => v + 1);
              }}
            >
              Refresh status
            </Button>
          )}
          {article.error_message && (
            <p className="mt-6 rounded-xl bg-sage p-5">
              {article.error_message}
            </p>
          )}
          {article.status === "FAILED" && article.processing_attempts < 3 && (
            <Button className="mt-4" disabled={busy} onClick={retry}>
              {busy ? "Queuing…" : "Retry processing"}
            </Button>
          )}
          {concepts.length > 0 && (
            <section className="mt-10" aria-label="Learning material">
              <h2 className="text-2xl font-semibold">
                Key ideas & recall questions
              </h2>
              <p className="mt-3 text-sm text-muted">
                Generated by Gemma. Check the supporting passages for context.
              </p>
              {article.processing_note && (
                <p className="mt-2 text-sm text-muted">
                  {article.processing_note}
                </p>
              )}
              <div className="mt-6 space-y-5">
                {concepts.map((concept) => (
                  <section
                    key={concept.id}
                    className="rounded-2xl border border-forest/15 bg-white/50 p-5 sm:p-6"
                  >
                    <h3 className="text-xl font-semibold">{concept.title}</h3>
                    <p className="mt-3 leading-relaxed">
                      {concept.explanation}
                    </p>
                    <blockquote className="mt-4 border-l-2 border-forest/30 pl-4 text-sm text-muted">
                      {concept.source_excerpt}
                    </blockquote>
                    {concept.cards.map((card) => (
                      <div
                        key={card.id}
                        className="mt-5 border-t border-forest/10 pt-5"
                      >
                        <p className="font-medium">{card.question}</p>
                        <details className="mt-3">
                          <summary className="cursor-pointer font-medium underline">
                            Reveal answer
                          </summary>
                          <p className="mt-3 leading-relaxed">{card.answer}</p>
                        </details>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            </section>
          )}
          {article.content && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Article text</h2>
              <div className="mt-4 whitespace-pre-wrap break-words text-lg leading-relaxed">
                {article.content}
              </div>
            </section>
          )}
          <p className="mt-10 border-t border-forest/15 pt-6 text-sm text-muted">
            {article.status === "READY" ? (
              <>
                Your cards are ready for active recall.{" "}
                <Link
                  href="/dashboard/review"
                  className="font-medium underline"
                >
                  Start Recall
                </Link>
              </>
            ) : (
              "Recall cards will be available after successful processing."
            )}
          </p>
        </>
      )}
    </article>
  );
}
