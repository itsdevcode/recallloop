import type { NextRequest } from "next/server";
import { proxyApi } from "@/lib/server-proxy";

export async function GET(request: NextRequest) {
  const query = new URLSearchParams();
  for (const key of ["limit", "offset", "status"]) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) query.set(key, value);
  }
  return proxyApi(request, `/api/v1/articles?${query}`);
}
export async function POST(request: NextRequest) {
  return proxyApi(request, "/api/v1/articles");
}
