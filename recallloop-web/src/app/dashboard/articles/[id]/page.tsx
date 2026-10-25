"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import { articleRequest, type ArticleDetail } from "@/lib/articles";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  return <ArticleView key={id} id={id} />;
}

function ArticleView({ id }: { id: string }) {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    articleRequest<ArticleDetail>(`/${id}`)
      .then((value) => {
        if (active) setArticle(value);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401)
          router.replace("/login");
        else
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load the article.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, attempt, router]);
  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/dashboard/articles" className="text-sm underline">
        Back to library
      </Link>
      {error ? (
        <div role="alert" className="mt-8">
          <p>{error}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Retry
          </Button>
        </div>
      ) : !article ? (
        <p role="status" className="mt-8">
          Loading article…
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted">
            {article.source || new URL(article.url).hostname} · {article.status}
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
          {article.error_message && (
            <p role="status" className="mt-6 rounded-xl bg-sage p-5">
              {article.error_message}
            </p>
          )}
          {article.content && (
            <div className="mt-8 whitespace-pre-wrap break-words text-lg leading-relaxed">
              {article.content}
            </div>
          )}
          <p className="mt-10 border-t border-forest/15 pt-6 text-sm text-muted">
            AI-generated recall cards are coming in a future phase.
          </p>
        </>
      )}
    </article>
  );
}
