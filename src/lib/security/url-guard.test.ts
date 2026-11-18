import { describe, expect, it } from "vitest";

import { allowedHostsFromEnv, parseAllowedUrl } from "@/lib/security/url-guard";

const ALLOWED = ["en.wikipedia.org"];

describe("parseAllowedUrl", () => {
  it("accepts an allowlisted https URL", () => {
    const url = parseAllowedUrl("https://en.wikipedia.org/wiki/Photosynthesis", ALLOWED);
    expect(url.hostname).toBe("en.wikipedia.org");
  });

  it("accepts subdomains of an allowlisted host", () => {
    expect(() => parseAllowedUrl("https://simple.en.wikipedia.org/wiki/X", ALLOWED)).not.toThrow();
  });

  it("rejects http", () => {
    expect(() => parseAllowedUrl("http://en.wikipedia.org/wiki/X", ALLOWED)).toThrow(/https/);
  });

  it("rejects non-allowlisted hosts", () => {
    expect(() => parseAllowedUrl("https://evil.example.com/x", ALLOWED)).toThrow(/allowlist/);
  });

  it("rejects embedded credentials", () => {
    expect(() =>
      parseAllowedUrl("https://user:pass@en.wikipedia.org/wiki/X", ALLOWED),
    ).toThrow(/credentials/);
  });

  it("rejects non-default ports", () => {
    expect(() => parseAllowedUrl("https://en.wikipedia.org:8443/wiki/X", ALLOWED)).toThrow(/port/);
  });

  it("rejects the cloud metadata address", () => {
    expect(() => parseAllowedUrl("https://169.254.169.254/latest/meta-data", ["169.254.169.254"])).toThrow(
      /private/,
    );
  });

  it("rejects localhost and private ranges even if allowlisted", () => {
    expect(() => parseAllowedUrl("https://127.0.0.1/x", ["127.0.0.1"])).toThrow(/private/);
    expect(() => parseAllowedUrl("https://10.0.0.5/x", ["10.0.0.5"])).toThrow(/private/);
    expect(() => parseAllowedUrl("https://192.168.1.10/x", ["192.168.1.10"])).toThrow(/private/);
    expect(() => parseAllowedUrl("https://localhost/x", ["localhost"])).toThrow(/private/);
  });

  it("rejects IPv6 loopback", () => {
    expect(() => parseAllowedUrl("https://[::1]/x", ["[::1]"])).toThrow();
  });

  it("rejects malformed URLs", () => {
    expect(() => parseAllowedUrl("not a url", ALLOWED)).toThrow(/invalid/i);
  });

  it("does not treat a lookalike host as allowlisted", () => {
    expect(() => parseAllowedUrl("https://en.wikipedia.org.evil.com/x", ALLOWED)).toThrow(/allowlist/);
  });
});

describe("allowedHostsFromEnv", () => {
  it("parses a comma separated list", () => {
    expect(allowedHostsFromEnv("a.com, b.com ")).toEqual(["a.com", "b.com"]);
  });

  it("falls back to a safe default", () => {
    expect(allowedHostsFromEnv(undefined)).toEqual(["en.wikipedia.org"]);
  });
});
