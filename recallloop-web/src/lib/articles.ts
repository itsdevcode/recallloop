import { ApiError } from "@/lib/auth";

export type Article = {
  id: string;
  url: string;
  title: string | null;
  source: string | null;
  excerpt: string | null;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  error_message: string | null;
  created_at: string;
  updated_at: string;
  processing_attempts: number;
  processing_note: string | null;
  ai_model: string | null;
};
export type ArticleDetail = Article & { content: string | null };
export type ArticlePage = {
  items: Article[];
  total: number;
  limit: number;
  offset: number;
};

export async function articleRequest<T>(
  path = "",
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/articles${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers:
      method === "GET"
        ? {}
        : { "Content-Type": "application/json", "X-CSRF-Protection": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof payload.detail === "string"
        ? payload.detail
        : Array.isArray(payload.detail)
          ? payload.detail.map((item: { msg: string }) => item.msg).join(". ")
          : "Unable to complete the article request. Please try again.",
      response.status,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export type Concept = {
  id: string;
  title: string;
  explanation: string;
  source_excerpt: string;
  position: number;
  cards: { id: string; question: string; answer: string }[];
};
