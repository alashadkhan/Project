import type { ResearchErrorCode } from "@/lib/types";

const STATUS: Record<ResearchErrorCode, number> = {
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  INTERNAL: 500,
};

/**
 * Errors that are safe to show to a user. Anything that is not an AppError is
 * treated as an internal error and replaced with a generic message, so stack
 * traces and provider payloads never leak into the HTTP response.
 */
export class AppError extends Error {
  readonly code: ResearchErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(code: ResearchErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function toPublicError(error: unknown): { code: ResearchErrorCode; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  return { code: "INTERNAL", message: "Something went wrong while building the report." };
}
