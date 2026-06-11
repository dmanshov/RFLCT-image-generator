import { ApiKeyError, type ImagePayload } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function model(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
}

/**
 * Roept het Gemini-beeldmodel aan en geeft het gegenereerde beeld terug.
 * `images` zijn optionele invoerbeelden (bv het referentie- of "voor"-beeld)
 * voor image-to-image bewerkingen.
 */
export async function geminiGenerateImage(opts: {
  prompt: string;
  images?: ImagePayload[];
}): Promise<ImagePayload> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new ApiKeyError(
      "gemini",
      "GEMINI_API_KEY ontbreekt. Voeg je Google Gemini-sleutel toe aan .env.local (zie .env.example)."
    );
  }

  const parts: unknown[] = [{ text: opts.prompt }];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${model()}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    });
  } catch (err) {
    throw new Error(
      `Kon Gemini niet bereiken (netwerk). Controleer je internetverbinding. Detail: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && /API key not valid/i.test(text)) {
      throw new ApiKeyError("gemini", "De Gemini-sleutel is ongeldig. Controleer GEMINI_API_KEY.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new ApiKeyError(
        "gemini",
        "Geen toegang tot Gemini (401/403). Controleer GEMINI_API_KEY en of het beeldmodel beschikbaar is voor jouw account."
      );
    }
    throw new Error(`Gemini-fout ${res.status}: ${text.slice(0, 600)}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const candidate = json.candidates?.[0];
  const responseParts = candidate?.content?.parts ?? [];

  for (const part of responseParts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      return {
        mimeType: inline.mimeType ?? inline.mime_type ?? "image/png",
        data: inline.data,
      };
    }
  }

  // Geen beeld? Vaak omdat het model tekst teruggaf (bv een weigering of veiligheidsblok).
  const textBack = responseParts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ");
  const blockReason = json.promptFeedback?.blockReason;
  throw new Error(
    `Gemini gaf geen afbeelding terug.${blockReason ? ` Blokkering: ${blockReason}.` : ""}${
      textBack ? ` Model zei: "${textBack.slice(0, 300)}".` : ""
    } Probeer opnieuw of pas je parameters/prompt aan.`
  );
}

interface GeminiInlineData {
  mimeType?: string;
  mime_type?: string;
  data?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  promptFeedback?: { blockReason?: string };
}
