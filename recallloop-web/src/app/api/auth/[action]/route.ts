import type { NextRequest } from "next/server";
import { proxyApi } from "@/lib/server-proxy";

const actions: Record<string, string> = {
  register: "POST",
  login: "POST",
  logout: "POST",
  me: "GET",
};

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (!Object.hasOwn(actions, action) || actions[action] !== request.method) {
    return Response.json({ detail: "Not found" }, { status: 404 });
  }
  return proxyApi(request, `/api/v1/auth/${action}`);
}
export { proxy as GET, proxy as POST };
