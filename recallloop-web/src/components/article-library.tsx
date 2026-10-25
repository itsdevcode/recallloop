"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
      setNotice(
        article.status === "FAILED"
          ? `Saved, but extraction failed: ${article.error_message}`
          : "Article saved and ready to read.",
      );
      await load();
    } catch (error) {
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
  return (
    <section
      className="mt-8"
      aria-label={recent ? "Recent articles" : "Article library"}
    >
      <form
        onSubmit={add}
        className="rounded-2xl border border-forest/15 bg-sage/30 p-5 sm:p-6"
      >
        <label htmlFor="article-url" className="block font-medium">
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
            className="min-w-0 flex-1 rounded-xl border border-forest/20 bg-white px-4 py-3 focus:outline-2 focus:outline-forest"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : "Save article"}
          </Button>
        </div>
        <p className="mt-3 text-sm text-muted">
          Public HTML articles only. Extraction may take up to 20 seconds.
        </p>
      </form>
      {notice && (
        <p role="status" className="mt-5 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-800/20 p-4 text-red-800"
        >
          <p>{error}</p>
          <button
            className="mt-2 font-medium underline"
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
      <h2 className="mt-8 text-xl font-semibold">
        {recent ? "Recent articles" : "Saved articles"}{" "}
        <span className="font-normal text-muted">({total})</span>
      </h2>
      {loading && (
        <p role="status" className="mt-5 text-muted">
          Loading articles…
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-forest/25 p-8 text-center">
          <h3 className="font-semibold">Your library starts here</h3>
          <p className="mt-2 text-muted">
            Save your first article to keep its readable text in one place.
          </p>
        </div>
      )}
      <ul className="mt-5 space-y-4">
        {items.map((article) => (
          <li
            key={article.id}
            className="rounded-2xl border border-forest/15 bg-white/50 p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span className="break-all">
                {article.source || new URL(article.url).hostname}
              </span>
              <span className="rounded-full bg-sage px-3 py-1 font-medium text-forest">
                {article.status}
              </span>
            </div>
            <Link
              href={`/dashboard/articles/${article.id}`}
              className="mt-3 block break-words text-lg font-semibold underline-offset-4 hover:underline"
            >
              {article.title || article.url}
            </Link>
            {article.excerpt && (
              <p className="mt-3 break-words text-sm leading-relaxed text-muted">
                {article.excerpt}
              </p>
            )}
            {article.error_message && (
              <p className="mt-3 text-sm text-red-800">
                {article.error_message}
              </p>
            )}
            {confirmId === article.id ? (
              <div
                role="group"
                aria-label="Confirm deletion"
                className="mt-4 flex flex-wrap items-center gap-4 text-sm"
              >
                <p>Delete this saved article?</p>
                <button
                  disabled={busy}
                  onClick={() => void remove(article.id)}
                  className="font-semibold text-red-800 underline"
                >
                  Confirm delete
                </button>
                <button
                  disabled={busy}
                  onClick={() => setConfirmId(null)}
                  className="underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                disabled={busy}
                onClick={() => setConfirmId(article.id)}
                className="mt-4 text-sm text-muted underline"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {!recent && items.length < total && (
        <Button
          className="mt-6"
          disabled={loading || busy}
          onClick={() => {
            setError("");
            setLoading(true);
            void load(items.length);
          }}
        >
          Load more
        </Button>
      )}
    </section>
  );
}
