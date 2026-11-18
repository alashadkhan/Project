import { NextResponse } from "next/server";

import { providerName } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.npm_package_version ?? "1.0.0";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      version: VERSION,
      provider: providerName(),
      region: process.env.GOOGLE_CLOUD_REGION ?? null,
      project: process.env.GOOGLE_CLOUD_PROJECT ?? null,
      uptimeSeconds: Math.round(process.uptime()),
    },
    {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}
