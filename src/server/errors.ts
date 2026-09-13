export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super(`Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`);
    this.name = "RateLimitError";
  }
}
