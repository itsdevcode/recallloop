import type { NextRequest } from "next/server";
import { proxyApi } from "@/lib/server-proxy";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return Response.json({ detail: "Article not found" }, { status: 404 });
  }
  return proxyApi(request, `/api/v1/articles/${id}`);
}
export { proxy as GET, proxy as DELETE };
