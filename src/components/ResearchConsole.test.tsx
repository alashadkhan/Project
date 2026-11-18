import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResearchConsole } from "@/components/ResearchConsole";
import { makeReport } from "@/test/fixtures";
import type { ResearchEvent } from "@/lib/types";

function streamResponse(events: ResearchEvent[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResearchConsole", () => {
  it("validates short claims before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ResearchConsole />);
    await user.type(screen.getByLabelText("Claim or question"), "short");
    await user.click(screen.getByRole("button", { name: "Check this claim" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/at least 8 characters/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills the form from an example", async () => {
    const user = userEvent.setup();
    render(<ResearchConsole />);

    await user.click(screen.getByRole("button", { name: "Octopuses have three hearts." }));

    expect(screen.getByLabelText("Claim or question")).toHaveValue("Octopuses have three hearts.");
  });

  it("runs a check and renders the streamed report", async () => {
    const report = makeReport();
    const events: ResearchEvent[] = [
      {
        type: "status",
        agent: "planner",
        phase: "started",
        message: "Decomposing the claim into research questions",
        at: "2026-11-18T10:00:00.000Z",
      },
      { type: "subquestions", questions: [{ id: "Q1", question: "What is the evidence?" }] },
      {
        type: "source",
        source: report.sources[0]!,
      },
      { type: "claims", claims: report.claims },
      { type: "conflicts", conflicts: [] },
      {
        type: "status",
        agent: "synthesizer",
        phase: "completed",
        message: "Report ready",
        at: "2026-11-18T10:00:05.000Z",
        durationMs: 100,
      },
      { type: "report", report },
    ];

    const fetchMock = vi.fn().mockResolvedValue(streamResponse(events));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ResearchConsole />);
    await user.type(screen.getByLabelText("Claim or question"), "Octopuses have three hearts.");
    await user.click(screen.getByRole("button", { name: "Check this claim" }));

    expect(await screen.findByRole("heading", { name: "Verification report" })).toBeInTheDocument();
    expect(screen.getByText("Supported")).toBeInTheDocument();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      claim: "Octopuses have three hearts.",
      depth: "standard",
    });
  });

  it("shows the server's error message for a rejected request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many runs. Try again in 30s." } }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const user = userEvent.setup();
    render(<ResearchConsole />);
    await user.type(screen.getByLabelText("Claim or question"), "Octopuses have three hearts.");
    await user.click(screen.getByRole("button", { name: "Check this claim" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Too many runs/);
  });

  it("lets the user choose a research depth", async () => {
    const report = makeReport({ depth: "deep" });
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse([{ type: "report", report }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ResearchConsole />);
    await user.type(screen.getByLabelText("Claim or question"), "Octopuses have three hearts.");
    await user.click(screen.getByRole("radio", { name: /Deep/ }));
    await user.click(screen.getByRole("button", { name: "Check this claim" }));

    await screen.findByRole("heading", { name: "Verification report" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).depth).toBe("deep");
  });
});
