import type { NextRequest } from "next/server";

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
  const headers = new Headers();
  // Preserve security headers; never fabricate an allowed Origin or CSRF header.
  for (const name of [
    "cookie",
    "origin",
    "content-type",
    "x-csrf-protection",
    "sec-fetch-site",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
  try {
    const response = await fetch(new URL(`/api/v1/auth/${action}`, upstream), {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    const contentType = response.headers.get("content-type");
    if (contentType) outgoing.set("Content-Type", contentType);
    for (const cookie of response.headers.getSetCookie())
      outgoing.append("Set-Cookie", cookie);
    return new Response(response.body, {
      status: response.status,
      headers: outgoing,
    });
  } catch {
    return Response.json(
      { detail: "Authentication service is unavailable. Please try again." },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

export { proxy as GET, proxy as POST };
