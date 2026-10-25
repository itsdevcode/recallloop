import type { NextRequest } from "next/server";

// Callers must supply a fixed, allowlisted API path, never a request URL.
export async function proxyApi(request: NextRequest, path: string) {
  const headers = new Headers();
  for (const name of [
    "cookie",
    "origin",
    "content-type",
    "x-csrf-protection",
    "sec-fetch-site",
    "idempotency-key",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  // Render hostport references contain no scheme; the value stays server-only.
  const configured = process.env.API_INTERNAL_URL;
  const upstream = configured
    ? configured.includes("://")
      ? configured
      : `http://${configured}`
    : "http://127.0.0.1:8000";
  try {
    const response = await fetch(new URL(path, upstream), {
      method: request.method,
      headers,
      body: request.method === "POST" ? await request.text() : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
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
      { detail: "The service is unavailable. Please try again." },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
