import type { NextRequest } from "next/server";
import { proxyApi } from "@/lib/server-proxy";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const collection =
    path.length === 1 &&
    ["due", "stats", "schedule", "history"].includes(path[0]) &&
    request.method === "GET";
  const card =
    path[0] === "cards" &&
    uuid.test(path[1] || "") &&
    ((path.length === 2 && request.method === "POST") ||
      (path.length === 3 && path[2] === "answer" && request.method === "GET"));
  if (!collection && !card)
    return Response.json(
      { detail: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  const query = new URLSearchParams();
  if (collection && ["due", "history"].includes(path[0])) {
    for (const key of path[0] === "history" ? ["limit", "offset"] : ["limit"]) {
      const value = request.nextUrl.searchParams.get(key);
      if (value !== null) query.set(key, value);
    }
  }
  return proxyApi(
    request,
    `/api/v1/reviews/${path.join("/")}${query.size ? `?${query}` : ""}`,
  );
}
export { proxy as GET, proxy as POST };
