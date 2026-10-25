"use client";
import Link from "next/link";
import { useUser } from "@/components/dashboard-shell";
import { RecallSummary } from "@/components/recall-summary";
import { ArticleLibrary } from "@/components/article-library";

export default function DashboardPage() {
  const user = useUser();
  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome, {user.name}.</h1>
      <p className="mt-3 text-muted">Save something worth remembering.</p>
      <RecallSummary />
      <ArticleLibrary recent />
      <Link
        href="/dashboard/articles"
        className="mt-6 inline-block font-medium underline underline-offset-4"
      >
        View all articles
      </Link>
    </>
  );
}
