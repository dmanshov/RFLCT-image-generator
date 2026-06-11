// Keuzelijsten voor de variatie-parameters. Hier kan je gerust opties
// toevoegen of verwijderen; de UI en prompts pakken ze automatisch op.

export const ROOM_TYPES = [
  "woonkamer",
  "open keuken",
  "gesloten keuken",
  "eetkamer",
  "master bedroom",
  "kinderkamer",
  "badkamer",
  "inkomhal",
  "thuiskantoor",
  "veranda",
  "terras",
  "tuin",
  "zolderkamer",
  "kelder / berging",
  "garage",
];

export const PROPERTY_TYPES = [
  "appartement",
  "studio",
  "loft",
  "rijwoning",
  "halfopen bebouwing",
  "vrijstaande woning",
  "villa",
  "landelijke woning",
  "nieuwbouw",
  "herenhuis",
];

export const STYLES = [
  "modern",
  "minimalistisch",
  "scandinavisch",
  "industrieel",
  "landelijk",
  "klassiek",
  "bohemien",
  "luxueus",
  "mid-century",
  "japandi",
];

export const LIGHTING = [
  "heldere zonnige dag",
  "zacht bewolkt daglicht",
  "warm gouden uur",
  "fris ochtendlicht",
  "gezellige avond met warme lampen",
];

export const ASPECTS = [
  { value: "4:5", label: "Portret 4:5 (Instagram feed)" },
  { value: "1:1", label: "Vierkant 1:1" },
  { value: "9:16", label: "Verticaal 9:16 (Story/Reel)" },
  { value: "3:2", label: "Landschap 3:2" },
  { value: "16:9", label: "Breed 16:9" },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomParams() {
  return {
    roomType: pick(ROOM_TYPES),
    propertyType: pick(PROPERTY_TYPES),
    style: pick(STYLES),
    lighting: pick(LIGHTING),
  };
}
