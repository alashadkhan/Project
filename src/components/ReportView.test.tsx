import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportView } from "@/components/ReportView";
import { makeReport } from "@/test/fixtures";

describe("ReportView", () => {
  it("renders the verdict, confidence and claim", () => {
    render(<ReportView report={makeReport()} onReset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Verification report" })).toBeInTheDocument();
    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getAllByText(/Octopuses have three hearts/).length).toBeGreaterThan(0);
  });

  it("exposes confidence to assistive technology as a meter", () => {
    render(<ReportView report={makeReport()} onReset={vi.fn()} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", "72");
    expect(meter).toHaveAttribute("aria-valuetext", "72 percent confidence");
  });

  it("links citations to their sources in a new tab without leaking referrers", () => {
    render(<ReportView report={makeReport()} onReset={vi.fn()} />);
    const link = screen.getAllByRole("link", { name: /Octopus/ })[0];
    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Octopus");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.getAttribute("rel")).toContain("noreferrer");
  });

  it("moves focus to the report heading when it appears", () => {
    render(<ReportView report={makeReport()} onReset={vi.fn()} />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Verification report" }),
    );
  });

  it("copies the markdown report and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<ReportView report={makeReport()} onReset={vi.fn()} />);
    // fireEvent keeps the clipboard stub installed above; user-event replaces it.
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown" }));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain("# Verification report");
    expect(await screen.findByText("Markdown report copied to clipboard.")).toBeInTheDocument();
  });

  it("shows a helpful state when no claims survived", () => {
    render(<ReportView report={makeReport({ claims: [], verdict: "insufficient_evidence" })} onReset={vi.fn()} />);
    expect(screen.getByText(/did not contain enough verifiable material/i)).toBeInTheDocument();
    expect(screen.getByText("Insufficient evidence")).toBeInTheDocument();
  });

  it("calls onReset when asked to check another claim", async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<ReportView report={makeReport()} onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: "Check another claim" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
