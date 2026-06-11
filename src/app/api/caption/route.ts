import { NextRequest, NextResponse } from "next/server";
import { generateCaption } from "@/lib/anthropic";
import { captionPrompt, DEFAULT_BRAND_CONTEXT } from "@/lib/prompts";
import { errorResponse } from "@/lib/apiError";
import { fromDataUrl, type GenerationParams } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface CaptionBody {
  params: GenerationParams;
  beforeDataUrl: string;
  afterDataUrl: string;
  brandContext?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CaptionBody;
    if (!body.beforeDataUrl || !body.afterDataUrl) {
      return NextResponse.json({ error: "Beide foto's zijn nodig voor de caption." }, { status: 400 });
    }

    const result = await generateCaption({
      prompt: captionPrompt({
        params: body.params,
        brandContext: body.brandContext?.trim() || DEFAULT_BRAND_CONTEXT,
      }),
      before: fromDataUrl(body.beforeDataUrl),
      after: fromDataUrl(body.afterDataUrl),
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
