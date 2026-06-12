import { ApiKeyError, type ImagePayload } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

function model(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
}

export interface CaptionResult {
  caption: string;
  toelichting: string;
}

/**
 * Laat Claude (met vision) een caption + korte toelichting schrijven op basis
 * van de "voor"- en "na"-foto.
 */
export async function generateCaption(opts: {
  prompt: string;
  before: ImagePayload;
  after: ImagePayload;
}): Promise<CaptionResult> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new ApiKeyError(
      "anthropic",
      "ANTHROPIC_API_KEY ontbreekt. Voeg je Anthropic/Claude-sleutel toe aan .env.local (zie .env.example)."
    );
  }

  const body = {
    model: model(),
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "VOOR-foto:" },
          imageBlock(opts.before),
          { type: "text", text: "NA-foto:" },
          imageBlock(opts.after),
          { type: "text", text: opts.prompt },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Kon Claude niet bereiken (netwerk). Detail: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new ApiKeyError("anthropic", "De Anthropic-sleutel is ongeldig (401). Controleer ANTHROPIC_API_KEY.");
    }
    throw new Error(`Claude-fout ${res.status}: ${text.slice(0, 600)}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  const text = (json.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();

  return parseCaption(text);
}

function imageBlock(img: ImagePayload) {
  return {
    type: "image",
    source: { type: "base64", media_type: img.mimeType, data: img.data },
  };
}

function parseCaption(text: string): CaptionResult {
  // Verwijder eventuele markdown code-fences (```json ... ```).
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();

  // Probeer elk gebalanceerd JSON-object (van { tot bijhorende }) te parsen,
  // van het langste naar het kortste, en neem het eerste dat een caption bevat.
  for (const candidate of balancedJsonObjects(cleaned)) {
    try {
      const parsed = JSON.parse(candidate) as Partial<CaptionResult>;
      if (parsed && typeof parsed.caption === "string" && parsed.caption.trim()) {
        return {
          caption: parsed.caption,
          toelichting: typeof parsed.toelichting === "string" ? parsed.toelichting : "",
        };
      }
    } catch {
      // probeer de volgende kandidaat
    }
  }
  // Geen bruikbare JSON gevonden: gebruik de (opgeschoonde) tekst als caption.
  return { caption: cleaned, toelichting: "" };
}

/** Geeft alle gebalanceerde {…}-objecten in de tekst terug, langste eerst. */
function balancedJsonObjects(text: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          results.push(text.slice(i, j + 1));
          break;
        }
      }
    }
  }
  return results.sort((a, b) => b.length - a.length);
}

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
}
