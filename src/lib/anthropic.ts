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
  // Claude is gevraagd om JSON; haal het JSON-blok eruit, ook als er per
  // ongeluk wat tekst of code-fences omheen staan.
  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<CaptionResult>;
      if (parsed.caption) {
        return {
          caption: String(parsed.caption),
          toelichting: String(parsed.toelichting ?? ""),
        };
      }
    } catch {
      // val terug op ruwe tekst
    }
  }
  return { caption: text, toelichting: "" };
}

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
}
