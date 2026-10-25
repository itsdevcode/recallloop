import { ApiError } from "@/lib/auth";

export type Rating = "FORGOT" | "HARD" | "EASY";
export type DueCard = {
  card_id: string;
  question: string;
  article_title: string | null;
  concept_title: string;
  next_review_at: string;
};
export type DuePage = {
  items: DueCard[];
  total_due: number;
  limit: number;
  as_of: string;
};
export type ReviewResult = {
  review_log_id: string;
  card_id: string;
  rating: Rating;
  reviewed_at: string;
  next_review_at: string;
  interval_days: number;
  repetition_count: number;
  ease_factor: number;
  review_count: number;
};
export type ReviewStats = {
  total_cards: number;
  due_now: number;
  reviewed_today: number;
  total_completed_reviews: number;
  upcoming_next_7_days: number;
  next_review_at: string | null;
  as_of: string;
};
export type ReviewSchedule = {
  as_of: string;
  overdue: number;
  due_today: number;
  upcoming: { date: string; count: number }[];
};
export type HistoryPage = {
  items: {
    id: string;
    card_id: string;
    question: string;
    article_title: string | null;
    rating: Rating;
    reviewed_at: string;
    next_review_at: string;
  }[];
  total: number;
  limit: number;
  offset: number;
};

export function localDate(value: string): string {
  return new Date(value).toLocaleString();
}

export async function reviewRequest<T>(
  path: string,
  data?: { rating: Rating },
  key?: string,
): Promise<T> {
  const response = await fetch(`/api/reviews/${path}`, {
    method: data ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: data
      ? {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1",
          ...(key ? { "Idempotency-Key": key } : {}),
        }
      : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof payload.detail === "string"
        ? payload.detail
        : "Unable to complete the review request. Please try again.",
      response.status,
    );
  }
  return response.json();
}
