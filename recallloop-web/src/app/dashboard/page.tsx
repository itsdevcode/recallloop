"use client";

import Link from "next/link";
import { useUser } from "@/components/dashboard-shell";
import { RecallSummary } from "@/components/recall-summary";
import { ArticleLibrary } from "@/components/article-library";

export default function DashboardPage() {
  const user = useUser();

  return (
    <div className="space-y-10 sm:space-y-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-dark sm:text-4xl">
          Welcome, {user.name}.
        </h1>
        <p className="mt-2 text-base text-muted">Save something worth remembering.</p>
      </div>

      <RecallSummary />

      <ArticleLibrary recent />

      <div className="pt-2">
        <Link
          href="/dashboard/articles"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest underline underline-offset-4 hover:text-forest/80"
        >
          View all articles <span>→</span>
        </Link>
      </div>
    </div>
  );
}
