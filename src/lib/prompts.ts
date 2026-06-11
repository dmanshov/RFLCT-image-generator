import type { GenerationParams } from "./types";

const ASPECT_FRAMING: Record<string, string> = {
  "4:5": "vertical 4:5 portrait framing",
  "1:1": "square 1:1 framing",
  "9:16": "tall vertical 9:16 framing",
  "3:2": "horizontal 3:2 landscape framing",
  "16:9": "wide 16:9 landscape framing",
};

function framing(aspect: string): string {
  return ASPECT_FRAMING[aspect] ?? "natural framing";
}

// Realisme-instructies die we overal aanhangen. De gebruiker wil absoluut
// vermijden dat de beelden er "overduidelijk AI-gegenereerd" uitzien.
const REALISM = [
  "The result must be 100% photorealistic and indistinguishable from a real photograph taken with a full-frame DSLR and a wide-angle lens.",
  "Natural, physically correct lighting and shadows; realistic materials, textures and reflections.",
  "No surreal, warped or impossible geometry; straight, believable architecture; correct perspective.",
  "Avoid the typical AI look: no plastic-smooth surfaces, no nonsensical objects, no duplicated or melted details, no garbled text on signs or books.",
  "Include subtle, natural real-world imperfections so it reads as an authentic photo.",
].join(" ");

/**
 * Prompt voor de "voor"-foto wanneer we vertrekken van een referentiebeeld
 * (URL of upload). We maken een gelijkaardige, maar originele en dus
 * copyright-veilige ruimte na, in dezelfde matige advertentie-look.
 */
export function beforeFromReferencePrompt(params: GenerationParams): string {
  return [
    "You are recreating a real estate listing photo as an ORIGINAL, copyright-free image.",
    "Look at the reference photo and recreate a similar-feeling room: keep the same room type, general layout, furniture style and overall vibe,",
    "but DO NOT copy it exactly — invent a plausibly different, original space so there is no copyright issue.",
    `Keep the same amateur, low-quality real-estate-listing look as a typical mediocre Immoweb/Zimmo ad: flat phone-camera lighting, an ordinary or slightly awkward camera angle, a slightly cluttered and lived-in space, somewhat dated styling.`,
    params.extra ? `Extra context to respect: ${params.extra}.` : "",
    REALISM,
    `Output a single photo with ${framing(params.aspect)}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Prompt voor de "voor"-foto wanneer we volledig uit parameters vertrekken
 * (geen referentiebeeld).
 */
export function beforeFromParamsPrompt(params: GenerationParams): string {
  return [
    `Generate an authentic but amateur, low-quality real estate listing photo of a ${params.style} ${params.roomType} in a ${params.propertyType}.`,
    "It must look like a quick, unprofessional phone snapshot from a mediocre Belgian real-estate ad (Immoweb/Zimmo):",
    "flat and uneven lighting, an ordinary or slightly awkward angle, a bit cluttered and lived-in, slightly dated decor, nothing styled or staged.",
    "This is the 'before' image, so it should look ordinary and unremarkable — NOT polished.",
    params.extra ? `Extra context: ${params.extra}.` : "",
    REALISM,
    `Output a single photo with ${framing(params.aspect)}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Prompt voor de "na"-foto. Krijgt het "voor"-beeld mee en herfotografeert
 * EXACT dezelfde ruimte als een topfotograaf — zonder nieuwe elementen.
 */
export function afterPrompt(params: GenerationParams): string {
  return [
    "You are a top-tier professional real estate photographer rephotographing THIS EXACT SAME ROOM shown in the provided image.",
    "Critical rule: it is the SAME physical space. Do NOT add, remove or invent architecture, windows, doors, walls or NEW furniture. Keep the same room shape, the same windows and doors in the same places, and the same existing furniture and objects.",
    "Do exactly what a real photographer would do on the shoot day to make it advertisement-worthy:",
    "declutter and tidy up, remove only loose mess and clutter, choose a better and more flattering camera angle and composition, straighten the vertical lines,",
    "apply bright, clean, balanced professional real-estate lighting, and tastefully restage and rearrange the EXISTING furniture and props for a more inviting look.",
    `Lighting mood: ${params.lighting}.`,
    params.extra ? `Also respect: ${params.extra}.` : "",
    "The two images must clearly read as the same room, before and after a professional shoot.",
    REALISM,
    `Output a single photo with ${framing(params.aspect)}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Prompt voor Claude om de caption + korte toelichting te schrijven.
 * Claude krijgt de "voor"- en "na"-foto mee als beeld.
 */
export function captionPrompt(opts: {
  params: GenerationParams;
  brandContext: string;
}): string {
  return [
    "Je bent social-media copywriter voor RFLCT (www.rflct.be).",
    "Context over RFLCT:",
    opts.brandContext.trim(),
    "",
    "Bij dit bericht horen twee beelden: het EERSTE beeld is de 'voor'-foto (een matige vastgoedfoto), het TWEEDE beeld is de professionele 'na'-foto van diezelfde ruimte.",
    `Het gaat om een ${opts.params.roomType}.`,
    "",
    "Schrijf een korte maar krachtige Instagram-caption in het Nederlands die:",
    "- het voor/na-effect benadrukt en de meerwaarde van sterke vastgoedbeelden;",
    "- de diensten van RFLCT in de verf zet en eindigt met een subtiele call-to-action;",
    "- vlot en menselijk klinkt, niet als reclame-jargon; max ~3 korte zinnen + 1 regel met 4 tot 7 relevante hashtags.",
    "",
    "Geef daarnaast een korte 'toelichting' (2-3 zinnen, voor de maker zelf) die uitlegt wat er fotografisch verbeterd is tussen voor en na.",
    "",
    "Antwoord UITSLUITEND met geldige JSON in exact dit formaat, zonder extra tekst of markdown:",
    '{"caption": "<de caption met regeleindes als \\n>", "toelichting": "<de toelichting>"}',
  ].join("\n");
}

export const DEFAULT_BRAND_CONTEXT =
  "RFLCT helpt vastgoedmakelaars en eigenaars om panden sneller en beter te verkopen of verhuren met sterke, professionele beeldvorming. " +
  "We transformeren gewone, matige advertentiefoto's tot stijlvolle, advertentiewaardige beelden die opvallen en vertrouwen wekken. " +
  "Toon: professioneel, inspirerend en toegankelijk.";
