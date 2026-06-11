# RFLCT · Vastgoedfoto Generator

Een web-app die de content-workflow voor de [RFLCT](https://www.rflct.be)-socials
automatiseert. In één doorloop:

1. **Voor-foto** — Google Gemini genereert een matige, *copyright-veilige*
   vastgoedfoto. Je vertrekt van een **URL**, een **geüploade** advertentiefoto,
   of volledig uit **parameters**.
2. **Na-foto** — Gemini herfotografeert *exact dezelfde ruimte* als een
   professionele vastgoedfotograaf: opruimen, betere hoek, professioneel licht,
   herschikking van de bestaande meubels — zonder nieuwe elementen toe te voegen.
3. **Caption** — Claude (Anthropic) schrijft een korte, krachtige Nederlandse
   caption + een toelichting, met RFLCT-context.

Je downloadt beide beelden en kopieert de caption naar het klembord. De "na"-foto
is bedoeld als eerste beeld in je carrousel.

> ⚠️ Controleer elk beeld op realisme vóór je post — de prompts sturen sterk aan
> op fotorealisme, maar AI blijft AI.

## Snel starten

```bash
# 1. Dependencies installeren
npm install

# 2. Sleutels instellen
cp .env.example .env.local
#   en vul GEMINI_API_KEY en ANTHROPIC_API_KEY in

# 3. Lokaal draaien
npm run dev
# → open http://localhost:3000
```

### API-sleutels

| Variabele            | Waarvoor                | Verkrijgen via |
| -------------------- | ----------------------- | -------------- |
| `GEMINI_API_KEY`     | Beeldgeneratie          | <https://aistudio.google.com/app/apikey> |
| `ANTHROPIC_API_KEY`  | Caption + toelichting   | <https://console.anthropic.com/settings/keys> |

Optioneel kan je het beeldmodel (`GEMINI_IMAGE_MODEL`, standaard
`gemini-2.5-flash-image`) en het caption-model (`ANTHROPIC_MODEL`, standaard
`claude-sonnet-4-6`) overschrijven.

De app toont bovenaan een waarschuwing zolang een sleutel ontbreekt, en geeft
duidelijke foutmeldingen bij ongeldige sleutels of geblokkeerde generaties.

## Parameters voor variatie

Om je profiel gevarieerd te houden kies je per post: **ruimte**, **vastgoedtype**,
**stijl**, **licht/sfeer**, **beeldverhouding** en vrije **extra wensen**. De
knop **🎲 Verras me** zet willekeurige waarden. De keuzelijsten staan in
[`src/lib/options.ts`](src/lib/options.ts) en zijn vrij aan te passen.

Via **⚙︎ Instellingen** pas je de RFLCT-merkcontext/toon aan die aan Claude wordt
meegegeven. Je voorkeuren worden lokaal in de browser bewaard.

## Hoe het in elkaar zit

- **Next.js (App Router) + TypeScript + Tailwind**.
- API-sleutels blijven **server-side** (Next route handlers in `src/app/api/*`);
  ze worden nooit naar de browser gestuurd.
- Pipeline-stappen zijn aparte endpoints (`/api/before`, `/api/after`,
  `/api/caption`) zodat je elke stap apart opnieuw kan genereren.
- Promptlogica zit gebundeld in [`src/lib/prompts.ts`](src/lib/prompts.ts).

```
src/
  app/
    page.tsx          ← volledige UI (client component)
    api/
      before/         ← voor-foto (Gemini, evt. met referentie)
      after/          ← na-foto (Gemini, image-to-image)
      caption/        ← caption (Claude, vision)
      health/         ← rapporteert of sleutels ingesteld zijn
  lib/
    gemini.ts         ← Gemini-client
    anthropic.ts      ← Claude-client
    prompts.ts        ← alle prompts
    options.ts        ← keuzelijsten + random
    fetchImage.ts     ← referentiefoto via URL ophalen
    types.ts
```

## Deployen

De app draait op elke Node-host. Op **Vercel**: importeer de repo en zet
`GEMINI_API_KEY` en `ANTHROPIC_API_KEY` als Environment Variables. De
image-routes hebben een `maxDuration` van 120s ingesteld.
