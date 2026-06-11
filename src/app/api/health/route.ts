import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Geeft enkel terug OF de sleutels geconfigureerd zijn (niet de waarden),
// zodat de UI een waarschuwing kan tonen vooraleer je genereert.
export async function GET() {
  return NextResponse.json({
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  });
}
