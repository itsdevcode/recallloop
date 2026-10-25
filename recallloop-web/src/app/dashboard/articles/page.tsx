import { ArticleLibrary } from "@/components/article-library";

export default function ArticlesPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Your article library</h1>
      <p className="mt-3 text-muted">
        Keep the ideas you want to come back to.
      </p>
      <ArticleLibrary />
    </>
  );
}
