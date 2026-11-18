import { AppError } from "@/lib/errors";

/** Hostnames that must never be fetched, regardless of allowlist. */
const PRIVATE_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^metadata\.google\.internal$/i,
];

function isIpLiteral(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":") || host.startsWith("[");
}

/**
 * SSRF guard for server-side retrieval.
 *
 * The retriever must never be usable as a proxy into the deployment's private
 * network (Cloud Run metadata server at 169.254.169.254 is the classic target),
 * so URLs are constrained to https, a host allowlist, the default port, and no
 * embedded credentials.
 */
export function parseAllowedUrl(raw: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("INTERNAL", "Retriever produced an invalid URL.");
  }

  if (url.protocol !== "https:") {
    throw new AppError("INTERNAL", "Only https sources are allowed.");
  }
  if (url.username || url.password) {
    throw new AppError("INTERNAL", "Source URLs must not embed credentials.");
  }
  if (url.port && url.port !== "443") {
    throw new AppError("INTERNAL", "Source URLs must use the default port.");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new AppError("INTERNAL", "Source URL is missing a host.");
  if (isIpLiteral(host) || PRIVATE_PATTERNS.some((pattern) => pattern.test(host))) {
    throw new AppError("INTERNAL", "Source URL resolves to a private address.");
  }

  const allowed = allowedHosts.some(
    (candidate) => host === candidate.toLowerCase() || host.endsWith(`.${candidate.toLowerCase()}`),
  );
  if (!allowed) {
    throw new AppError("INTERNAL", "Source host is not on the retrieval allowlist.");
  }

  return url;
}

export function allowedHostsFromEnv(value: string | undefined): string[] {
  return (value ?? "en.wikipedia.org")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}
