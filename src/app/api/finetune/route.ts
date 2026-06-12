import { NextRequest, NextResponse } from "next/server";
import { geminiGenerateImage } from "@/lib/gemini";
import { renderFineTunePrompt } from "@/lib/prompts";
import { errorResponse } from "@/lib/apiError";
import { fromDataUrl, toDataUrl } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface FineTuneBody {
  /** het reeds gegenereerde beeld als data-URL */
  image: string;
  /** korte instructie over wat er moet wijzigen */
  instruction: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FineTuneBody;
    if (!body.image) {
      return NextResponse.json({ error: "Geen afbeelding meegegeven." }, { status: 400 });
    }
    if (!body.instruction || !body.instruction.trim()) {
      return NextResponse.json({ error: "Geef een instructie op om bij te werken." }, { status: 400 });
    }

    const base = fromDataUrl(body.image);
    const image = await geminiGenerateImage({
      prompt: renderFineTunePrompt(body.instruction),
      images: [base],
      // Geen rewrite: de strikte consistentie-instructie mag niet verrijkt/verwaterd
      // worden. Geen aspectRatio: behoud exact de afmetingen van het bronbeeld.
      rewrite: false,
    });
    return NextResponse.json({ image: toDataUrl(image) });
  } catch (err) {
    return errorResponse(err);
  }
}
