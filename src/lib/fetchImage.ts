import type { ImagePayload } from "./types";

/** Haalt een afbeelding op via URL en geeft ze terug als base64-payload. */
export async function fetchImageFromUrl(url: string): Promise<ImagePayload> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Ongeldige URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Enkel http(s)-URL's zijn toegelaten.");
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      headers: {
        // Sommige sites blokkeren requests zonder user-agent.
        "User-Agent":
          "Mozilla/5.0 (compatible; RFLCT-ImageGenerator/1.0; +https://www.rflct.be)",
        Accept: "image/*",
      },
    });
  } catch (err) {
    throw new Error(`Kon de afbeelding niet ophalen: ${(err as Error).message}`);
  }

  if (!res.ok) {
    throw new Error(`Kon de afbeelding niet ophalen (HTTP ${res.status}). Controleer de URL.`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(
      `De URL verwijst niet naar een afbeelding (content-type: ${contentType || "onbekend"}). Geef de directe link naar de foto.`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new Error("De opgehaalde afbeelding is leeg.");
  }

  return { mimeType: contentType.split(";")[0].trim(), data: buffer.toString("base64") };
}
