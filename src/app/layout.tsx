import type { Metadata, Viewport } from "next";

import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Veritas — evidence-backed fact-checking",
    template: "%s · Veritas",
  },
  description:
    "A multi-agent research and fact-checking system that decomposes a claim, retrieves sources, verifies each assertion, and shows its evidence trail.",
  applicationName: "Veritas",
  authors: [{ name: "Alashad Khan" }],
  keywords: ["fact-checking", "AI agents", "Gemini", "research", "evidence", "Veritas"],
  openGraph: {
    title: "Veritas — evidence-backed fact-checking",
    description:
      "Four agents, one evidence trail. Veritas checks claims against real sources and shows every citation.",
    type: "website",
    url: siteUrl,
    siteName: "Veritas",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veritas — evidence-backed fact-checking",
    description: "Multi-agent fact-checking with a visible evidence trail.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#090c10",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
