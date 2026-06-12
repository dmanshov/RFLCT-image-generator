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

// Standaard prompt-sjablonen. De gebruiker kan ze in de instellingen overschrijven.
// Placeholders tussen accolades worden bij het genereren ingevuld:
//   {roomType} {propertyType} {style} {lighting} {aspect} {framing} {extra}
//   (caption) {brandContext} {roomType} {service}
// {extra} wordt automatisch een zin met je extra wensen, of leeg als je niets invult.
export const DEFAULT_PROMPTS: PromptSet = {
  beforeReference: `You are recreating the room from the reference photo as an ORIGINAL, copyright-free image.
Recreate it AS FAITHFULLY AS POSSIBLE so it is immediately recognizable as the same room: keep the same room type and layout, the same camera viewpoint, angle and framing, the same furniture in the same positions, the same wall and floor colours and materials, the same windows, doors, proportions and the same overall lighting and mood. The result should look almost like the same photo.
To avoid copyright issues, change ONLY minor, incidental and replaceable details — e.g. the exact artwork on the walls, the specific decorative objects, books, plants, cushions, patterns and small props. Never change the layout, the furniture placement, the architecture or the camera angle.
Keep the same amateur, low-quality real-estate-listing look as the reference: flat phone-camera lighting, an ordinary or slightly awkward camera angle, a slightly cluttered and lived-in space, somewhat dated styling.
{extra}
${REALISM}
Output a single photo that closely matches the reference's composition and framing.`,

  beforeParams: `Generate an authentic but amateur, low-quality real estate listing photo of a {style} {roomType} in a {propertyType}.
It must look like a quick, unprofessional phone snapshot from a mediocre Belgian real-estate ad (Immoweb/Zimmo): flat and uneven lighting, an ordinary or slightly awkward angle, a bit cluttered and lived-in, slightly dated decor, nothing styled or staged.
This is the 'before' image, so it should look ordinary and unremarkable — NOT polished.
{extra}
${REALISM}
Output a single photo with {framing}.`,

  afterStaging: `The provided image is a 'BEFORE' photo of a room (often dated, empty or unappealing). You are a professional virtual staging and renovation artist.
Produce the 'AFTER': a render of the SAME room, viewed from the EXACT SAME camera position, that has been significantly renovated and beautifully restyled.
ABSOLUTELY KEEP THE COMPOSITION IDENTICAL: the same camera angle, viewpoint, focal length, perspective and framing, and the same architectural shell — the same room dimensions and the same windows, doors and openings in exactly the same positions and sizes. The before and after must line up perfectly when overlaid; do NOT move, rotate or re-crop the camera.
You MAY fully renovate and restyle the interior: replace and add furniture, update the flooring, the wall finishes and paint, the light fixtures, and add tasteful decor and styling, so the space looks freshly renovated, high-end and move-in ready.
Make the transformation rich and impressive, like a premium interior makeover, while staying realistic for this type of property.
Lighting mood: {lighting}.
{extra}
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
Lighting mood: {lighting}.
{extra}
${REALISM}
Output a single photo with {framing}.`,

  caption: `Je bent social-media copywriter voor RFLCT (www.rflct.be).
Context over RFLCT:
{brandContext}

Bij dit bericht horen twee beelden: het EERSTE beeld is de 'voor'-foto (een matige vastgoedfoto), het TWEEDE beeld is de professionele 'na'-foto van diezelfde ruimte.
Het gaat om een {roomType}.
De getoonde dienst is: {service}. Stem de caption en de uitgelichte meerwaarde hierop af.

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

/** Vult placeholders in een sjabloon in en ruimt overtollige witruimte op. */
function applyVars(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{([a-zA-Z]\w*)\}/g, (match, key: string) => (key in vars ? vars[key] : match))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rendert een beeld-prompt (voor/na) met de gekozen parameters. */
export function renderImagePrompt(template: string, params: GenerationParams): string {
  const extra = params.extra && params.extra.trim();
  return applyVars(template, {
    roomType: params.roomType,
    propertyType: params.propertyType,
    style: params.style,
    lighting: params.lighting,
    aspect: params.aspect,
    framing: framing(params.aspect),
    extra: extra ? `Also respect this extra request: ${extra}.` : "",
  });
}

const SERVICE_DESCRIPTION: Record<GenerationParams["service"], string> = {
  staging:
    "virtual staging — de ruimte werd digitaal gerenoveerd en opnieuw ingericht, met behoud van exact dezelfde camerahoek",
  retouch:
    "fotoretouche — exact dezelfde ruimte, maar professioneel opgeruimd, herschikt, belicht en gefotografeerd (geen nieuwe elementen toegevoegd)",
};

/** Rendert de caption-prompt met de merk-context en parameters. */
export function renderCaptionPrompt(
  template: string,
  params: GenerationParams,
  brandContext: string
): string {
  const rendered = applyVars(template, {
    brandContext: brandContext.trim(),
    roomType: params.roomType,
    service: SERVICE_DESCRIPTION[params.service] ?? params.service,
  });
  // Forceer het machine-formaat, ongeacht wat de gebruiker in het sjabloon zette.
  return rendered + CAPTION_OUTPUT_FORMAT;
}

export const DEFAULT_BRAND_CONTEXT =
  "RFLCT helpt vastgoedmakelaars en eigenaars om panden sneller en beter te verkopen of verhuren met sterke, professionele beeldvorming. " +
  "We transformeren gewone, matige advertentiefoto's tot stijlvolle, advertentiewaardige beelden die opvallen en vertrouwen wekken. " +
  "Toon: professioneel, inspirerend en toegankelijk.";
