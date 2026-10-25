export type PublicUser = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function authRequest<T>(
  action: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(`/api/auth/${action}`, {
    method: data === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers:
      data === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Protection": "1",
          },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload.detail === "string"
        ? payload.detail
        : Array.isArray(payload.detail)
          ? payload.detail.map((item: { msg: string }) => item.msg).join(". ")
          : "Unable to complete the request. Please try again.";
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
