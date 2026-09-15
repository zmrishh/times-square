export class RequestError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
    readonly retryAfter = 0,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export function requestErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      error.name === "TimeoutError" ||
      /signal.*timed out/i.test(error.message)
    )
      return "The connection took too long. Please check your connection and try again.";
    if (error.name === "AbortError")
      return "The request was interrupted. Please try again.";
    if (
      error instanceof TypeError &&
      /fetch|network|load failed/i.test(error.message)
    )
      return "Unable to connect. Please check your connection and try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const read = body === undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`/api/${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
        ...(read
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      let data;
      try {
        data = await response.json();
      } catch (error) {
        if (
          error instanceof Error &&
          ["TimeoutError", "AbortError"].includes(error.name)
        )
          throw error;
        throw new RequestError(
          "The server returned an incomplete response. Please try again.",
          true,
        );
      }
      if (!response.ok)
        throw new RequestError(
          typeof data?.error === "string"
            ? requestErrorMessage(new Error(data.error))
            : "This request could not be completed. Please try again.",
          response.status >= 500 || response.status === 408,
          Math.max(0, Math.min(86400, Number(data?.retryAfter || response.headers.get('Retry-After')) || 0)),
        );
      return data as T;
    } catch (error) {
      const transient =
        error instanceof RequestError
          ? error.retryable
          : error instanceof TypeError ||
            (error instanceof Error &&
              ["TimeoutError", "AbortError"].includes(error.name));
      // Only reads can be repeated automatically: a timed-out POST may have
      // completed on the server (including checkout, payments or publishing).
      if (read && transient && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      const message =
        !read && transient
          ? "We couldn't confirm this action. Check its status before trying again."
          : requestErrorMessage(error);
      throw new RequestError(message, transient, error instanceof RequestError ? error.retryAfter : 0);
    }
  }
}
