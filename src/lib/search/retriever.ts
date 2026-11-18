import { parseAllowedUrl } from "@/lib/security/url-guard";
import { safeText } from "@/lib/security/sanitize";
import type { Reliability, Source } from "@/lib/types";
import { logger } from "@/lib/logger";
import { truncate, uniqueBy } from "@/lib/utils";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOptions {
  limit: number;
  signal?: AbortSignal;
}

/** Port so the retriever can be tested without network access. */
export interface SearchClient {
  readonly name: string;
  search(query: string, options: SearchOptions): Promise<SearchHit[]>;
}

interface WikipediaPage {
  pageid?: number;
  title?: string;
  extract?: string;
  fullurl?: string;
}

/**
 * Wikipedia (MediaWiki Action API) retrieval.
 *
 * Chosen because it is free, needs no API key, returns stable permalinks for
 * citations, and is an encyclopaedia rather than a random web page. The
 * allowlist in `url-guard` is the security boundary; this client only ever
 * talks to the host it was configured with.
 */
export class WikipediaSearchClient implements SearchClient {
  readonly name = "wikipedia";
  private readonly host: string;
  private readonly timeoutMs: number;

  constructor(options: { host?: string; timeoutMs?: number } = {}) {
    this.host = options.host ?? "en.wikipedia.org";
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  async search(query: string, options: SearchOptions): Promise<SearchHit[]> {
    const limit = Math.min(8, Math.max(1, options.limit));
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "search",
      gsrsearch: query.slice(0, 300),
      gsrlimit: String(limit),
      gsrnamespace: "0",
      prop: "extracts|info",
      inprop: "url",
      exintro: "1",
      explaintext: "1",
      redirects: "1",
    });

    const url = `https://${this.host}/w/api.php?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });

    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": "VeritasFactCheck/1.0 (research demo; contact: maintainers)",
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Wikipedia responded ${response.status}`);
      }

      const payload = (await response.json()) as { query?: { pages?: WikipediaPage[] } };
      const pages = payload.query?.pages ?? [];

      return pages
        .filter((page) => Boolean(page.title && page.fullurl && page.extract))
        .map((page) => ({
          title: safeText(page.title, 200),
          url: page.fullurl as string,
          snippet: truncate(safeText(page.extract, 900), 600),
        }))
        .filter((hit) => hit.snippet.length > 40);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

/** Deterministic search client for tests and offline demos. */
export class MockSearchClient implements SearchClient {
  readonly name = "mock-search";

  constructor(private readonly hits: SearchHit[] = DEFAULT_HITS) {}

  async search(query: string): Promise<SearchHit[]> {
    const terms = query.toLowerCase();
    const filtered = this.hits.filter(
      (hit) =>
        hit.title.toLowerCase().includes(terms.slice(0, 8)) ||
        terms.includes(hit.title.toLowerCase().slice(0, 8)),
    );
    return (filtered.length > 0 ? filtered : this.hits).slice(0, 3);
  }
}

const DEFAULT_HITS: SearchHit[] = [
  {
    title: "Photosynthesis",
    url: "https://en.wikipedia.org/wiki/Photosynthesis",
    snippet:
      "Photosynthesis is a system of biological processes by which photosynthetic organisms convert light energy into chemical energy. It is performed by plants, algae and cyanobacteria.",
  },
  {
    title: "Chlorophyll",
    url: "https://en.wikipedia.org/wiki/Chlorophyll",
    snippet:
      "Chlorophyll is any of several related green pigments found in cyanobacteria and the chloroplasts of algae and plants. Chlorophyll absorbs light most strongly in the blue and red parts of the spectrum.",
  },
  {
    title: "Plant",
    url: "https://en.wikipedia.org/wiki/Plant",
    snippet:
      "Plants are the eukaryotes that form the kingdom Plantae; they are predominantly photosynthetic. Most plants are multicellular and obtain energy from sunlight.",
  },
];

export interface RetrievalInput {
  questions: Array<{ id: string; question: string }>;
  depth: "quick" | "standard" | "deep";
  search: SearchClient;
  allowedHosts: readonly string[];
  now: () => number;
  signal?: AbortSignal;
}

const PER_QUESTION: Record<RetrievalInput["depth"], number> = {
  quick: 2,
  standard: 3,
  deep: 4,
};

const MAX_SOURCES: Record<RetrievalInput["depth"], number> = {
  quick: 4,
  standard: 8,
  deep: 12,
};

/**
 * Turns research questions into a deduplicated, validated source set.
 * Invalid or non-allowlisted URLs are skipped rather than failing the whole
 * run: one bad citation should not discard a good report.
 */
export async function retrieveSources(input: RetrievalInput): Promise<Source[]> {
  const { questions, depth, search, allowedHosts, now, signal } = input;
  const perQuestion = PER_QUESTION[depth];
  const maxSources = MAX_SOURCES[depth];

  const settled = await Promise.allSettled(
    questions.map((question) => search.search(question.question, { limit: perQuestion, signal })),
  );

  const hits: SearchHit[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      hits.push(...result.value);
    } else {
      logger.warn("retriever.query_failed", { question: questions[index]?.id ?? index });
    }
  });

  const validated: Array<SearchHit & { url: string }> = [];
  for (const hit of hits) {
    try {
      const url = parseAllowedUrl(hit.url, allowedHosts);
      validated.push({ ...hit, url: url.toString() });
    } catch {
      logger.warn("retriever.url_rejected", { host: safeHost(hit.url) });
    }
  }

  const unique = uniqueBy(validated, (hit) => hit.url).slice(0, maxSources);
  const retrievedAt = new Date(now()).toISOString();

  return unique.map((hit, index) => ({
    id: `S${index + 1}`,
    title: safeText(hit.title, 200),
    url: hit.url,
    publisher: publisherFor(hit.url),
    retrievedAt,
    snippet: safeText(hit.snippet, 600),
    reliability: reliabilityFor(hit.url),
  }));
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).hostname.slice(0, 80);
  } catch {
    return "invalid";
  }
}

function publisherFor(raw: string): string {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    const [first] = host.split(".");
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : host;
  } catch {
    return "Unknown";
  }
}

function reliabilityFor(raw: string): Reliability {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host.endsWith(".gov") || host.endsWith(".edu")) return "high";
    if (host.endsWith("wikipedia.org")) return "medium";
    return "low";
  } catch {
    return "low";
  }
}
