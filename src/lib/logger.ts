type Level = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";
const SENSITIVE = /(api[-_]?key|authorization|token|secret|password|cookie)/i;

/**
 * Minimal structured logger. Cloud Run captures stdout as structured logs, and
 * `severity` is understood by Cloud Logging, so no extra agent is required.
 */
function emit(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = SENSITIVE.test(key) ? REDACTED : value;
  }

  const line = JSON.stringify({
    severity: level.toUpperCase(),
    event,
    time: new Date().toISOString(),
    ...safe,
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "production") return;
    emit("debug", event, fields);
  },
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
