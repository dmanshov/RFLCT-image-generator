import { ApiKeyError, type ImagePayload } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Modelstrings zijn configureerbaar via env-vars (niet hardcoded verspreid).
// Default beeldmodel = Nano Banana 2; legacy enkel als fallback.
function imageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image-preview";
}
function fallbackImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL_FALLBACK?.trim() || "gemini-2.5-flash-image";
}
function textModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash";
}
function imageSize(): string {
  return process.env.GEMINI_IMAGE_SIZE?.trim() || "2K";
}

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new ApiKeyError(
      "gemini",
      "GEMINI_API_KEY ontbreekt. Voeg je Google Gemini-sleutel toe aan .env.local (zie .env.example)."
    );
  }
  return key;
}

/** Het gevraagde model is niet (meer) beschikbaar op dit account. */
class ModelUnavailableError extends Error {}
/** Het model aanvaardt de meegegeven generation-config (imageConfig) niet. */
class ConfigUnsupportedError extends Error {}

export interface GenerateImageOptions {
  prompt: string;
  /** Optionele invoerbeelden (referentie- of "voor"-beeld) voor image-to-image. */
  images?: ImagePayload[];
  /** Gewenste beeldverhouding, bv "4:5". Weggelaten => model behoudt input-ratio. */
  aspectRatio?: string;
  /** Of de prompt eerst verrijkt wordt door het tekstmodel. Default: true. */
  rewrite?: boolean;
}

/**
 * Stap 1 (rewrite): verrijkt de ruwe service-prompt tot een gedetailleerde
 * beeldprompt via het tekstmodel. Behoudt expliciet alle harde regels. Faalt de
 * stap, dan vallen we terug op de ruwe prompt (generatie mag niet breken).
 */
export async function expandPrompt(rawPrompt: string): Promise<string> {
  const key = requireKey();
  const instruction =
    "Rewrite and enrich the following image-generation instruction into a single, vivid, " +
    "highly detailed prompt for a photorealistic real-estate image model. Add concrete " +
    "photographic and styling detail (lighting, lens, composition, materials, mood). " +
    "Keep EVERY hard rule and constraint exactly intact — do not loosen or remove any 'do not' " +
    "rule, and keep all locked/free boundaries and any automatically added context. " +
    "Return ONLY the rewritten prompt, no preamble.\n\n" + rawPrompt;

  try {
    const res = await fetch(
      `${BASE}/models/${textModel()}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: instruction }] }] }),
      }
    );
    if (!res.ok) {
      console.warn(`[gemini] prompt-rewrite faalde (${res.status}); val terug op ruwe prompt`);
      return rawPrompt;
    }
    const json = (await res.json()) as GeminiResponse;
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text)
      .filter(Boolean)
      .join(" ")
      .trim();
    return text || rawPrompt;
  } catch (err) {
    console.warn(`[gemini] prompt-rewrite error: ${(err as Error).message}; val terug op ruwe prompt`);
    return rawPrompt;
  }
}

/**
 * Stap 1 + 2: verrijkt de prompt en genereert het beeld. Image-to-image zodra er
 * invoerbeelden zijn. Probeert het ingestelde beeldmodel; bij een onbeschikbaar
 * model of niet-ondersteunde config wordt er netjes teruggevallen.
 */
export async function geminiGenerateImage(opts: GenerateImageOptions): Promise<ImagePayload> {
  requireKey();
  const finalPrompt = opts.rewrite === false ? opts.prompt : await expandPrompt(opts.prompt);

  const parts: unknown[] = [{ text: finalPrompt }];
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const primary = imageModel();
  const fallback = fallbackImageModel();

  try {
    return await callImageModel(primary, parts, opts.aspectRatio, true);
  } catch (err) {
    // Config niet ondersteund door dit model → opnieuw zonder generation-config.
    if (err instanceof ConfigUnsupportedError) {
      console.warn(`[gemini] ${primary} aanvaardt imageConfig niet; opnieuw zonder config`);
      return await callImageModel(primary, parts, opts.aspectRatio, false);
    }
    // Model onbeschikbaar → val terug op legacy model (zonder imageConfig).
    if (err instanceof ModelUnavailableError && fallback !== primary) {
      console.warn(`[gemini] model ${primary} niet beschikbaar; val terug op ${fallback}`);
      try {
        return await callImageModel(fallback, parts, opts.aspectRatio, true);
      } catch (err2) {
        if (err2 instanceof ConfigUnsupportedError) {
          return await callImageModel(fallback, parts, opts.aspectRatio, false);
        }
        throw err2;
      }
    }
    throw err;
  }
}

async function callImageModel(
  model: string,
  parts: unknown[],
  aspectRatio: string | undefined,
  useImageConfig: boolean
): Promise<ImagePayload> {
  const key = requireKey();

  const body: Record<string, unknown> = { contents: [{ role: "user", parts }] };
  if (useImageConfig) {
    const imageConfig: Record<string, string> = { imageSize: imageSize() };
    if (aspectRatio) imageConfig.aspectRatio = aspectRatio;
    body.generationConfig = { responseModalities: ["IMAGE"], imageConfig };
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      `Kon Gemini niet bereiken (netwerk). Controleer je internetverbinding. Detail: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 || /not found|NOT_FOUND|is not supported|does not exist/i.test(text)) {
      throw new ModelUnavailableError(`Model ${model} niet beschikbaar: ${text.slice(0, 300)}`);
    }
    if (
      res.status === 400 &&
      /imageConfig|image_config|responseModalities|response_modalities|Unknown name|Invalid JSON payload/i.test(text)
    ) {
      throw new ConfigUnsupportedError(`Config niet ondersteund door ${model}: ${text.slice(0, 300)}`);
    }
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
  // Log het effectieve model (acceptatiecriterium): zo zie je in de Vercel-logs
  // welk model écht draaide t.o.v. het gevraagde.
  console.log(
    `[gemini] beeld — gevraagd=${model} effectief=${json.modelVersion ?? "onbekend"} config=${useImageConfig}`
  );

  const responseParts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of responseParts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      return {
        mimeType: inline.mimeType ?? inline.mime_type ?? "image/png",
        data: inline.data,
      };
    }
  }

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
  modelVersion?: string;
}
