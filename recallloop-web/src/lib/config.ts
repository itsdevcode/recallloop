// Public values are embedded at build time. Never put secrets in NEXT_PUBLIC_ variables.
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, "");
