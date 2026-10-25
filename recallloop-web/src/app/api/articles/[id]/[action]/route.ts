import type { NextRequest } from "next/server";
import { proxyApi } from "@/lib/server-proxy";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !(
      (action === "concepts" && request.method === "GET") ||
      (action === "retry" && request.method === "POST")
    )
  ) {
    return Response.json(
      { detail: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return proxyApi(request, `/api/v1/articles/${id}/${action}`);
}
export { proxy as GET, proxy as POST };
