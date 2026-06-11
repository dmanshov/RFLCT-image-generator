import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { loadSettings, saveSettings } from "@/lib/settings";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/prompts";
import type { GenerationParams, InputMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await loadSettings();
    if (!settings) {
      // Geen DB: laat de client terugvallen op zijn lokale cache.
      return NextResponse.json({
        persisted: false,
        settings: { brandContext: DEFAULT_BRAND_CONTEXT },
      });
    }
    return NextResponse.json({ persisted: true, settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Geen database geconfigureerd. Stel DATABASE_URL in (Vercel/Neon).", kind: "no_db" },
      { status: 503 }
    );
  }
  try {
    const body = (await req.json()) as {
      brandContext?: string;
      params?: Partial<GenerationParams>;
      mode?: InputMode;
    };
    await saveSettings({
      brandContext: String(body.brandContext ?? ""),
      params: body.params,
      mode: body.mode,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
