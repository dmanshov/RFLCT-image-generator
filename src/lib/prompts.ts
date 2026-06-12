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

// Realisme-instructies. De gebruiker wil absoluut vermijden dat de beelden er
// "overduidelijk AI-gegenereerd" uitzien. Dit is mee opgenomen in de standaard-
// sjablonen zodat de gebruiker ze ook zelf kan aanpassen.
const REALISM = [
  "The result must be 100% photorealistic and indistinguishable from a real photograph taken with a full-frame DSLR and a wide-angle lens.",
  "Natural, physically correct lighting and shadows; realistic materials, textures and reflections.",
  "No surreal, warped or impossible geometry; straight, believable architecture; correct perspective.",
  "Avoid the typical AI look: no plastic-smooth surfaces, no nonsensical objects, no duplicated or melted details, no garbled text on signs or books.",
  "Include subtle, natural real-world imperfections so it reads as an authentic photo.",
].join(" ");

export type PromptKey =
  | "beforeReference"
  | "beforeParams"
  | "afterStaging"
  | "afterRetouch"
  | "caption";
export type PromptSet = Record<PromptKey, string>;

// Standaard prompt-sjablonen. De gebruiker kan ze in de instellingen overschrijven
// met VRIJE TEKST — geen placeholders of accolades nodig. De relevante parameters
// (ruimte, stijl, licht, beeldverhouding, dienst, merk-context, extra wensen)
// worden bij het genereren automatisch als een contextblok onderaan toegevoegd.
export const DEFAULT_PROMPTS: PromptSet = {
  beforeReference: `You are recreating the room from the reference photo as an ORIGINAL, copyright-free image.
Recreate it AS FAITHFULLY AS POSSIBLE so it is immediately recognizable as the same room: keep the same room type and layout, the same camera viewpoint, angle and framing, the same furniture in the same positions, the same wall and floor colours and materials, the same windows, doors, proportions and the same overall lighting and mood. The result should look almost like the same photo.
To avoid copyright issues, change ONLY minor, incidental and replaceable details — e.g. the exact artwork on the walls, the specific decorative objects, books, plants, cushions, patterns and small props. Never change the layout, the furniture placement, the architecture or the camera angle.
Keep the same amateur, low-quality real-estate-listing look as the reference: flat phone-camera lighting, an ordinary or slightly awkward camera angle, a slightly cluttered and lived-in space, somewhat dated styling.
${REALISM}
Output a single photo that closely matches the reference's composition and framing.`,

  beforeParams: `Generate an authentic but amateur, low-quality real estate listing photo of the room described in the context below.
It must look like a quick, unprofessional phone snapshot from a mediocre Belgian real-estate ad (Immoweb/Zimmo): flat and uneven lighting, an ordinary or slightly awkward angle, a bit cluttered and lived-in, slightly dated decor, nothing styled or staged.
This is the 'before' image, so it should look ordinary and unremarkable — NOT polished.
${REALISM}
Output a single photo in the requested framing.`,

  afterStaging: `The provided image is a 'BEFORE' photo of a room (often dated, empty or unappealing). You are a professional virtual staging and renovation artist.
Produce the 'AFTER': a render of the SAME room, viewed from the EXACT SAME camera position, that has been significantly renovated and beautifully restyled.
ABSOLUTELY KEEP THE COMPOSITION IDENTICAL: the same camera angle, viewpoint, focal length, perspective and framing, and the same architectural shell — the same room dimensions and the same windows, doors and openings in exactly the same positions and sizes. The before and after must line up perfectly when overlaid; do NOT move, rotate or re-crop the camera.
You MAY fully renovate and restyle the interior: replace and add furniture, update the flooring, the wall finishes and paint, the light fixtures, and add tasteful decor and styling, so the space looks freshly renovated, high-end and move-in ready.
Make the transformation rich and impressive, like a premium interior makeover, while staying realistic for this type of property.
${REALISM}
Keep the original composition and framing of the before photo exactly.`,

  afterRetouch: `The provided image is an amateur 'BEFORE' real estate photo. You are an award-winning professional real estate photographer.
Produce the 'AFTER': a striking, magazine-quality photo of THIS EXACT SAME ROOM as a pure photographic retouch — NOT a renovation.
HARD RULES: do NOT renovate or redecorate, and do NOT add any new element that is not already present in the before photo (no new furniture, no new decor, no added plants, flowers, throws or props, no new fixtures or finishes). The room, its furniture and its finishes stay exactly as they are.
What you MAY do — everything a top photographer does on the shoot day:
- Declutter and tidy: remove loose mess, clutter, cables, dishes, laundry and personal items so the space looks clean and spacious.
- Rearrange and restage the EXISTING furniture and objects into a tidier, more attractive layout; straighten and align everything.
- Lighting transformation: turn flat, dull, dim phone lighting into bright, airy, professional real-estate lighting with lifted shadows, clean neutral white balance and a luminous HDR-like glow.
- Composition: you may change the camera angle and framing for a stronger, well-balanced shot with perfectly straight vertical and horizontal lines.
- Finish: crisp professional color grading, rich but natural colours, a warm inviting yet realistic ambiance.
The improvement must be DRAMATIC and immediately obvious versus the before, purely through cleanup, lighting, composition and grading — never by adding or changing objects. Do NOT return the before image unchanged.
${REALISM}
Output a single photo in the requested framing.`,

  caption: `Je bent social-media copywriter voor RFLCT (www.rflct.be).

Bij dit bericht horen twee beelden: het EERSTE beeld is de 'voor'-foto (een matige vastgoedfoto), het TWEEDE beeld is de professionele 'na'-foto van diezelfde ruimte.

Schrijf een korte maar krachtige Instagram-caption in het Nederlands die:
- het voor/na-effect benadrukt en de meerwaarde van sterke vastgoedbeelden;
- de diensten van RFLCT in de verf zet en eindigt met een subtiele call-to-action;
- vlot en menselijk klinkt, niet als reclame-jargon; max ~3 korte zinnen + 1 regel met 4 tot 7 relevante hashtags.

Geef daarnaast een korte 'toelichting' (2-3 zinnen, voor de maker zelf) die uitlegt wat er fotografisch verbeterd is tussen voor en na.`,
};

// Het machine-uitvoerformaat wordt ALTIJD door de app toegevoegd, los van het
// (bewerkbare) caption-sjabloon hierboven. Zo kan een eigen prompt het
// verwachte JSON-formaat nooit breken.
const CAPTION_OUTPUT_FORMAT = `

Antwoord UITSLUITEND met geldige JSON in exact dit formaat, zonder extra tekst, uitleg of markdown-codeblokken:
{"caption": "<de caption met regeleindes als \\n>", "toelichting": "<de toelichting>"}`;

/** Maakt één contextregel, of "" als er geen waarde is. */
function line(label: string, value?: string): string {
  return value && value.trim() ? `- ${label}: ${value.trim()}` : "";
}

/** Bouwt het automatische contextblok voor een beeld-prompt. */
function imageContext(key: PromptKey, params: GenerationParams): string {
  const lines: string[] = [];
  if (key === "beforeParams") {
    lines.push(line("Room", params.roomType));
    lines.push(line("Property type", params.propertyType));
    lines.push(line("Style", params.style));
    lines.push(line("Desired framing", framing(params.aspect)));
  } else if (key === "beforeReference") {
    lines.push("- Match the composition and framing of the provided reference photo.");
  } else if (key === "afterStaging") {
    // Compositie blijft identiek aan de voor-foto: geen nieuwe framing opleggen.
    lines.push(line("Lighting mood", params.lighting));
  } else if (key === "afterRetouch") {
    lines.push(line("Lighting mood", params.lighting));
    lines.push(line("Desired framing", framing(params.aspect)));
  }
  lines.push(line("Extra request to respect", params.extra));

  const body = lines.filter(Boolean).join("\n");
  return body ? `\n\nAdditional context (provided automatically — follow it):\n${body}` : "";
}

/** Verwijdert overtollige witruimte en lege regels. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rendert een beeld-prompt (voor/na). Het sjabloon is vrije tekst; de parameters
 * worden als contextblok onderaan toegevoegd. Voor backward-compatibiliteit met
 * oudere sjablonen worden eventuele resterende placeholders nog leeggemaakt.
 */
export function renderImagePrompt(
  template: string,
  params: GenerationParams,
  key: PromptKey
): string {
  return tidy(stripLegacyPlaceholders(template)) + imageContext(key, params);
}

/**
 * Prompt om een reeds gegenereerd beeld bij te werken op basis van een korte
 * front-end instructie. De gevraagde wijzigingen moeten KORDAAT en VOLLEDIG
 * worden toegepast; enkel wat niet genoemd wordt, blijft behouden.
 */
export function renderFineTunePrompt(instruction: string): string {
  return [
    "Edit the provided image. Apply the following change(s) requested by the user — fully, decisively and clearly visibly in the result:",
    `"${instruction.trim()}"`,
    "Every requested change MUST actually be carried out and be obviously visible; do not ignore, soften or only partially apply any of them.",
    "Keep the parts of the scene that the request does not mention consistent with the original (same room, architecture, and untouched furniture and composition), so it still reads as the same photo — but the requested changes themselves must be applied boldly and completely, not minimally.",
    REALISM,
    "Output the single edited photo.",
  ].join(" ");
}


const SERVICE_DESCRIPTION: Record<GenerationParams["service"], string> = {
  staging:
    "virtual staging — de ruimte werd digitaal gerenoveerd en opnieuw ingericht, met behoud van exact dezelfde camerahoek",
  retouch:
    "fotoretouche — exact dezelfde ruimte, maar professioneel opgeruimd, herschikt, belicht en gefotografeerd (geen nieuwe elementen toegevoegd)",
};

/**
 * Verwijdert oude {placeholder}-tokens uit eerder opgeslagen sjablonen, zodat er
 * nooit accolades in de uiteindelijke prompt terechtkomen. Vrije tekst zonder
 * accolades blijft volledig ongewijzigd.
 */
function stripLegacyPlaceholders(template: string): string {
  const known =
    /\{(roomType|propertyType|style|lighting|aspect|framing|extra|brandContext|service)\}/g;
  return template.replace(known, "");
}

/** Rendert de caption-prompt: vrije tekst + automatisch contextblok + JSON-formaat. */
export function renderCaptionPrompt(
  template: string,
  params: GenerationParams,
  brandContext: string
): string {
  const context = [
    line("Over RFLCT", brandContext),
    line("Ruimte", params.roomType),
    line("Uitgelichte dienst", SERVICE_DESCRIPTION[params.service] ?? params.service),
  ]
    .filter(Boolean)
    .join("\n");
  const contextBlock = context ? `\n\nContext (automatisch toegevoegd):\n${context}` : "";
  return tidy(stripLegacyPlaceholders(template)) + contextBlock + CAPTION_OUTPUT_FORMAT;
}

export const DEFAULT_BRAND_CONTEXT =
  "RFLCT helpt vastgoedmakelaars en eigenaars om panden sneller en beter te verkopen of verhuren met sterke, professionele beeldvorming. " +
  "We transformeren gewone, matige advertentiefoto's tot stijlvolle, advertentiewaardige beelden die opvallen en vertrouwen wekken. " +
  "Toon: professioneel, inspirerend en toegankelijk.";
