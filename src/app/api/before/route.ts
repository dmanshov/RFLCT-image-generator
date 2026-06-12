import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateImage } from "@/lib/gemini";
import { fetchImageFromUrl } from "@/lib/fetchImage";
import { DEFAULT_PROMPTS, renderImagePrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/apiError";
import { fromDataUrl, toDataUrl, type GenerationParams, type ImagePayload, type InputMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface BeforeBody {
  mode: InputMode;
  params: GenerationParams;
  /** voor mode "url" */
  url?: string;
  /** voor mode "upload": data-URL */
  uploadDataUrl?: string;
  /** optioneel eigen prompt-sjabloon */
  promptTemplate?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BeforeBody;
    const { mode, params } = body;

    let reference: ImagePayload | undefined;
    if (mode === "url") {
      if (!body.url) return NextResponse.json({ error: "Geen URL opgegeven." }, { status: 400 });
      reference = await fetchImageFromUrl(body.url);
    } else if (mode === "upload") {
      if (!body.uploadDataUrl) return NextResponse.json({ error: "Geen foto geüpload." }, { status: 400 });
      reference = fromDataUrl(body.uploadDataUrl);
    }

    const key = reference ? "beforeReference" : "beforeParams";
    const template = body.promptTemplate?.trim() || DEFAULT_PROMPTS[key];
    const image = await geminiGenerateImage({
      prompt: renderImagePrompt(template, params, key),
      images: reference ? [reference] : undefined,
      aspectRatio: params.aspect,
    });

    return NextResponse.json({ image: toDataUrl(image) });
  } catch (err) {
    return errorResponse(err);
  }
}
