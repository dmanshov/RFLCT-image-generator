import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateImage } from "@/lib/gemini";
import { DEFAULT_PROMPTS, renderImagePrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/apiError";
import { fromDataUrl, toDataUrl, type GenerationParams } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AfterBody {
  params: GenerationParams;
  /** de "voor"-foto als data-URL */
  beforeDataUrl: string;
  /** optioneel eigen prompt-sjabloon */
  promptTemplate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AfterBody;
    if (!body.beforeDataUrl) {
      return NextResponse.json({ error: "Geen 'voor'-foto meegegeven." }, { status: 400 });
    }
    const before = fromDataUrl(body.beforeDataUrl);
    const fallback =
      body.params.service === "staging" ? DEFAULT_PROMPTS.afterStaging : DEFAULT_PROMPTS.afterRetouch;
    const template = body.promptTemplate?.trim() || fallback;
    const image = await geminiGenerateImage({
      prompt: renderImagePrompt(template, body.params),
      images: [before],
    });
    return NextResponse.json({ image: toDataUrl(image) });
  } catch (err) {
    return errorResponse(err);
  }
}
