export type InputMode = "url" | "upload" | "params" | "direct";

/**
 * Welke RFLCT-dienst de "na"-foto uitlicht:
 * - "staging": virtual staging — compositie blijft identiek, ruimte mag volledig
 *   gerenoveerd/heringericht worden.
 * - "retouch": fotoretouche — geen renovatie en geen nieuwe elementen, wel
 *   opruimen/herschikken/herbelichten; compositie mag wijzigen.
 */
export type ServiceType = "staging" | "retouch";

export interface GenerationParams {
  roomType: string;
  propertyType: string;
  style: string;
  lighting: string;
  /** Beeldverhouding, bv "4:5" */
  aspect: string;
  /** Welke dienst de na-foto uitlicht. */
  service: ServiceType;
  /** Vrije extra wensen van de gebruiker. */
  extra?: string;
}

/** Een afbeelding zoals doorgegeven tussen client en server. */
export interface ImagePayload {
  /** bv "image/png" of "image/jpeg" */
  mimeType: string;
  /** base64 (zonder data:-prefix) */
  data: string;
}

export function toDataUrl(img: ImagePayload): string {
  return `data:${img.mimeType};base64,${img.data}`;
}

export function fromDataUrl(dataUrl: string): ImagePayload {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new Error("Ongeldige data-URL.");
  }
  return { mimeType: match[1], data: match[2] };
}

/** Fout die aangeeft dat een API-sleutel ontbreekt of ongeldig is. */
export class ApiKeyError extends Error {
  readonly provider: "gemini" | "anthropic";
  constructor(provider: "gemini" | "anthropic", message: string) {
    super(message);
    this.name = "ApiKeyError";
    this.provider = provider;
  }
}
