import { NextResponse } from "next/server";

import { runResearch } from "@/lib/agents/orchestrator";
import { AppError, toPublicError } from "@/lib/errors";
import { researchRequestSchema } from "@/lib/schemas";
import { TtlCache } from "@/lib/cache";
import { FixedWindowRateLimiter } from "@/lib/security/rate-limit";
import { allowedHosts, createLlm, createSearch, providerName } from "@/lib/providers";
import { logger } from "@/lib/logger";
import type { ResearchEvent, ResearchReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024;

const limiter = new FixedWindowRateLimiter({
  max: Number(process.env.RATE_LIMIT_MAX ?? 8),
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
});

const reportCache = new TtlCache<string, ResearchReport>({
  maxEntries: 120,
  ttlMs: 15 * 60 * 1000,
});

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function jsonError(code: string, message: string, status: number, retryAfter?: number): NextResponse {
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (retryAfter !== undefined) headers["retry-after"] = String(retryAfter);
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  const limit = limiter.check(clientKey(request));
  if (!limit.allowed) {
    return jsonError(
      "RATE_LIMITED",
      `Too many runs. Try again in ${limit.retryAfterSeconds}s.`,
      429,
      limit.retryAfterSeconds,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonError("INVALID_INPUT", "Request body is too large.", 413);
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return jsonError("INVALID_INPUT", "Request body is too large.", 413);
    }
    raw = JSON.parse(text) as unknown;
  } catch {
    return jsonError("INVALID_INPUT", "Send a JSON body with a claim and depth.", 400);
  }

  const parsed = researchRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return jsonError("INVALID_INPUT", message, 400);
  }

  const { claim, depth } = parsed.data;
  const provider = providerName();
  const cacheKey = `${provider}:${depth}:${claim.toLowerCase()}`;

  const encoder = new TextEncoder();
  const controller = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const send = (event: ResearchEvent) => {
        streamController.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const abort = () => controller.abort();
      request.signal.addEventListener("abort", abort, { once: true });

      try {
        const cached = reportCache.get(cacheKey);
        if (cached) {
          const cachedReport: ResearchReport = {
            ...cached,
            durationMs: Date.now() - startedAt,
          };
          send({
            type: "status",
            agent: "planner",
            phase: "completed",
            message: "Served from cache",
            at: new Date().toISOString(),
            durationMs: 0,
          });
          send({ type: "report", report: cachedReport });
          logger.info("research.cache_hit", { depth, provider });
          return;
        }

        const report = await runResearch({
          claim,
          depth,
          deps: {
            llm: createLlm(),
            search: createSearch(),
            allowedHosts: allowedHosts(),
            timeoutMs: Number(process.env.RESEARCH_TIMEOUT_MS ?? 55_000),
          },
          emit: send,
          signal: controller.signal,
        });

        reportCache.set(cacheKey, report);
        logger.info("research.completed", {
          depth,
          provider,
          durationMs: Date.now() - startedAt,
          sources: report.sources.length,
          claims: report.claims.length,
          verdict: report.verdict,
        });
      } catch (error) {
        const publicError = toPublicError(error);
        send({ type: "error", ...publicError });
        logger.warn("research.error", {
          code: publicError.code,
          status: error instanceof AppError ? error.status : 500,
          durationMs: Date.now() - startedAt,
        });
      } finally {
        request.signal.removeEventListener("abort", abort);
        streamController.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-accel-buffering": "no",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: { code: "INVALID_INPUT", message: "Use POST to run a fact-check." } },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
