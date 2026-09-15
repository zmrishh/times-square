export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number, message?: string) {
    super(message || `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
    this.name = "RateLimitError";
  }
}

export function isDatabaseUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? String(error.code) : "";
  return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "08000", "08001", "08003", "08006", "53300", "57P01", "57P02", "57P03"].includes(code)
    || /timeout exceeded when trying to connect|connection terminated unexpectedly|connection terminated due to connection timeout/i.test(error.message);
}
