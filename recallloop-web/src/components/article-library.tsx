"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/auth";
import { articleRequest, type Article, type ArticlePage } from "@/lib/articles";

export function ArticleLibrary({ recent = false }: { recent?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [url, setUrl] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const limit = recent ? 5 : 10;
  const pollCount = useRef(0);
  const [pollPaused, setPollPaused] = useState(false);

  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401)
        router.replace("/login");
      else
        setError(
          error instanceof Error
            ? error.message
            : "Unable to connect. Please try again.",
        );
    },
    [router],
  );

  const load = useCallback(
    async (offset = 0) => {
      try {
        const page = await articleRequest<ArticlePage>(
          `?limit=${limit}&offset=${offset}`,
        );
        setItems((previous) =>
          offset ? [...previous, ...page.items] : page.items,
        );
        setTotal(page.total);
        setError("");
      } catch (error) {
        fail(error);
      } finally {
        setLoading(false);
      }
    },
    [limit, fail],
  );

  useEffect(() => {
    let active = true;
    articleRequest<ArticlePage>(`?limit=${limit}&offset=0`)
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((error) => {
        if (active) fail(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit, fail]);

  useEffect(() => {
    if (
      !items.some(
        (item) => item.status === "PENDING" || item.status === "PROCESSING",
      )
    )
      return;
    let active = true;
    let fetching = false;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || fetching) return;
      if (pollCount.current >= 100) {
        setPollPaused(true);
        window.clearInterval(timer);
        return;
      }
      pollCount.current += 1;
      fetching = true;
      try {
        const page = await articleRequest<ArticlePage>(
          `?limit=${Math.min(100, Math.max(items.length, limit))}&offset=0`,
        );
        if (active) {
          setItems((previous) => [
            ...page.items,
            ...previous.slice(page.items.length),
          ]);
          setTotal(page.total);
        }
      } catch (error) {
        if (active) fail(error);
      } finally {
        fetching = false;
      }
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [items, limit, fail]);

  async function retryProcessing(id: string) {
    setBusy(true);
    setError("");
    try {
      const article = await articleRequest<Article>(`/${id}/retry`, "POST", {});
      pollCount.current = 0;
      setPollPaused(false);
      setItems((previous) =>
        previous.map((value) => (value.id === id ? article : value)),
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const article = await articleRequest<Article>("", "POST", {
        url: url.trim(),
      });
      setUrl("");
      setNotice("Article saved. Learning material is being prepared.");
      setItems((previous) => [article, ...previous].slice(0, limit));
      setTotal((previous) => previous + 1);
      pollCount.current = 0;
      setPollPaused(false);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) await load();
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await articleRequest(`/${id}`, "DELETE");
      setConfirmId(null);
      await load();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  function statusBadge(status: Article["status"]) {
    switch (status) {
      case "READY":
        return "bg-sage text-forest font-semibold";
      case "PROCESSING":
        return "bg-blue-50 text-blue-700 font-medium";
      case "PENDING":
        return "bg-black/[0.05] text-muted font-medium";
      case "FAILED":
        return "bg-red-50 text-red-700 font-semibold";
      default:
        return "bg-surface text-muted";
    }
  }

  return (
    <section
      className="mt-8"
      aria-label={recent ? "Recent articles" : "Article library"}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="eyebrow text-forest">
          {recent ? "Quick Save Article" : "Keep your next good read"}
        </h2>
      </div>

      <form
        onSubmit={add}
        className="rounded-3xl border border-black/[0.06] bg-surface p-5 sm:p-7 shadow-2xs"
      >
        <label htmlFor="article-url" className="block text-sm font-semibold text-dark">
          Save an article
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="article-url"
            type="url"
            required
            maxLength={2048}
            value={url}
            disabled={busy}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/article"
            className="min-w-0 flex-1 rounded-2xl border border-black/15 bg-white px-4 py-3 text-dark placeholder:text-muted/60 transition-all focus:border-forest focus:outline-2 focus:outline-forest/30 shadow-2xs"
          />
          <Button type="submit" disabled={busy} className="min-h-12 px-7">
            {busy ? "Please wait…" : "Save article"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Public HTML articles only. Processing continues in the background.
        </p>
      </form>

      {notice && (
        <div role="status" className="mt-4 rounded-2xl bg-sage/60 border border-sage-dark p-4 text-xs font-medium text-forest">
          <p>{notice}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800"
        >
          <p>{error}</p>
          <button
            className="mt-2 font-semibold underline"
            onClick={() => {
              setError("");
              setLoading(true);
              void load();
            }}
          >
            Retry loading articles
          </button>
        </div>
      )}

      {pollPaused && (
        <p className="mt-4 text-xs text-muted">
          Automatic updates paused.{" "}
          <button
            className="underline font-medium text-dark"
            onClick={() => {
              pollCount.current = 0;
              setPollPaused(false);
              void load();
            }}
          >
            Refresh status
          </button>
        </p>
      )}

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-dark">
          {recent ? "Recent articles" : "Saved articles"}{" "}
          <span className="font-normal text-muted">({total})</span>
        </h2>
      </div>

      {loading && (
        <div role="status" className="skeleton mt-4 p-8 text-center text-sm text-muted">
          <p>Loading articles…</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-4 rounded-3xl border border-dashed border-black/15 bg-white p-10 text-center shadow-2xs">
          <h3 className="text-base font-semibold text-dark">Your library starts here</h3>
          <p className="mt-1.5 text-sm text-muted">
            Save your first article to keep its readable text in one place.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-3.5">
        {items.map((article) => (
          <li
            key={article.id}
            className="group rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="break-all font-medium text-muted">
                {article.source || new URL(article.url).hostname}
              </span>
              <span className={`rounded-full px-3 py-0.5 text-xs ${statusBadge(article.status)}`}>
                {article.status}
              </span>
            </div>

            <Link
              href={`/dashboard/articles/${article.id}`}
              className="mt-2.5 block break-words text-lg font-semibold tracking-tight text-dark transition-colors group-hover:text-forest"
            >
              {article.title || article.url}
            </Link>

            {article.excerpt && (
              <p className="mt-2 break-words text-sm leading-relaxed text-muted line-clamp-2">
                {article.excerpt}
              </p>
            )}

            {article.error_message && (
              <p className="mt-3 text-xs font-medium text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-100">
                {article.error_message}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium">
              {article.status === "FAILED" && article.processing_attempts < 3 && (
                <Button
                  className="min-h-9 px-4 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void retryProcessing(article.id)}
                >
                  Retry processing
                </Button>
              )}

              {confirmId === article.id ? (
                <div
                  role="group"
                  aria-label="Confirm deletion"
                  className="flex flex-wrap items-center gap-3 text-xs"
                >
                  <p className="font-medium text-dark">Delete this saved article?</p>
                  <button
                    disabled={busy}
                    onClick={() => void remove(article.id)}
                    className="font-semibold text-red-700 underline underline-offset-2"
                  >
                    Confirm delete
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setConfirmId(null)}
                    className="text-muted underline underline-offset-2 hover:text-dark"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => setConfirmId(article.id)}
                  className="text-muted underline underline-offset-2 hover:text-red-700 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!recent && items.length < total && (
        <div className="mt-8 text-center">
          <Button
            className="min-h-11 px-8"
            disabled={loading || busy}
            onClick={() => {
              setError("");
              setLoading(true);
              void load(items.length);
            }}
          >
            Load more
          </Button>
        </div>
      )}
    </section>
  );
}
