/**
 * Control characters, zero-width characters and bidi overrides have no place in
 * research output. They can be used to hide text, spoof UI, or smuggle
 * "Trojan Source" style payloads into copy/paste buffers, so we strip them
 * before anything reaches the UI or a downloaded report.
 */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const TAGS = /<[^>]*>/g;

export function safeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(INVISIBLE, "")
    .replace(TAGS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, maxLength));
}

/**
 * Wraps untrusted retrieved text in explicit delimiters and neutralises the
 * delimiter itself, so a malicious page cannot close the wrapper and inject
 * instructions into the verifier prompt.
 */
export function asUntrusted(id: string, text: string): string {
  const cleaned = safeText(text, 1200).replaceAll("</untrusted_source>", "");
  return `<untrusted_source id="${id}">${cleaned}</untrusted_source>`;
}

/** Removes characters that would break a Markdown link/text export. */
export function markdownSafe(input: string): string {
  return safeText(input, 4000).replace(/([[\]()])/g, "\\$1");
}
