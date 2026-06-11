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
    "You are recreating the room from the reference photo as an ORIGINAL, copyright-free image.",
    "Recreate it AS FAITHFULLY AS POSSIBLE so it is immediately recognizable as the same room: keep the same room type and layout,",
    "the same camera viewpoint, angle and framing, the same furniture in the same positions, the same wall and floor colours and materials,",
    "the same windows, doors, proportions and the same overall lighting and mood. The result should look almost like the same photo.",
    "To avoid copyright issues, change ONLY minor, incidental and replaceable details — e.g. the exact artwork on the walls, the specific decorative objects, books, plants, cushions, patterns and small props.",
    "Never change the layout, the furniture placement, the architecture or the camera angle.",
    "Keep the same amateur, low-quality real-estate-listing look as the reference: flat phone-camera lighting, an ordinary or slightly awkward camera angle, a slightly cluttered and lived-in space, somewhat dated styling.",
    params.extra ? `Extra context to respect: ${params.extra}.` : "",
    REALISM,
    "Output a single photo that closely matches the reference's composition and framing.",
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
    "The provided image is an amateur 'BEFORE' real estate photo. You are an award-winning professional real estate photographer and home stylist.",
    "Produce the 'AFTER': a striking, magazine-quality real estate photo of THIS EXACT SAME ROOM.",
    "Keep the same physical space: the same room shape, the same windows and doors in the same places, the same walls and floor, and the same TYPES of main furniture. Do NOT invent a different room and do NOT add new architecture or extra big furniture pieces.",
    "",
    "CRUCIAL: the improvement must be DRAMATIC and immediately obvious — a clear 'wow' difference compared to the before. Do NOT return the before image unchanged or only slightly changed. Apply everything a top photographer + stylist does on a professional shoot:",
    "• Declutter completely — remove all loose mess, clutter, cables, dishes, laundry, random clutter and personal items so the space looks clean, tidy and spacious.",
    "• Lighting transformation — turn flat, dull, dim phone lighting into bright, airy, professional real-estate lighting: lifted shadows, clean neutral white balance, a luminous HDR-like glow, sunlight gently coming through the windows.",
    "• Composition — choose a stronger, wider, well-balanced camera angle with perfectly straight vertical and horizontal lines and a clean, deliberate framing.",
    "• Styling — restage and rearrange the existing furniture into an inviting, magazine-worthy layout, fluff and straighten textiles, and add only subtle, natural finishing touches that a stylist would bring (e.g. a neatly folded throw, fresh flowers or a plant, neatly arranged cushions) — tasteful and minimal, fitting the room.",
    "• Finish — crisp professional color grading, rich but natural colors, a warm and inviting yet realistic ambiance, clean and polished overall.",
    `• Lighting mood: ${params.lighting}.`,
    params.extra ? `• Also respect: ${params.extra}.` : "",
    "",
    "The two photos must clearly read as the SAME room before and after, but the after must look dramatically brighter, cleaner, tidier, better composed and more professional than the before.",
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
