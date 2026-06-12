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

De flow is **gefaseerd**: stap 1 genereert enkel de "voor"-foto. Pas wanneer je
die **goedkeurt**, worden de "na"-foto en caption gegenereerd — zo verspil je geen
Gemini-credits aan een "voor"-foto die je toch niet wil. Ben je niet tevreden,
klik dan op *Nieuwe "voor"-foto*.

Onder elk gegenereerd beeld kan je **fine-tunen**: typ een korte instructie (bv.
"maak het wat lichter" of "verwijder de stoel links") en Gemini vertrekt van dát
beeld en past *enkel* dat aan, met behoud van al de rest. De consistentie-regels
zitten in de back-endprompt, dus je hoeft zelf geen volledige prompt te schrijven.
Fine-tunen kan herhaald worden (elk resultaat wordt de nieuwe basis).

> Het machine-uitvoerformaat van de caption (strikte JSON) wordt altijd door de
> app afgedwongen, los van je eigen caption-prompt. Je kan de caption-prompt dus
> vrij aanpassen zonder de verwerking te breken.

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
| `APP_PASSWORD`       | Login (alleen jij)      | kies zelf een sterk wachtwoord |

### Beeldgeneratie-pipeline (twee stappen)

Om API-resultaten het niveau van de Gemini-app te laten benaderen, verloopt elke
beeldgeneratie in twee stappen:

1. **Prompt-rewrite** — de ruwe service-prompt gaat eerst door een tekstmodel
   (`GEMINI_TEXT_MODEL`, default `gemini-2.5-flash`) dat er een rijke,
   gedetailleerde beeldprompt van maakt, met behoud van álle harde regels.
2. **Beeldgeneratie** — de verrijkte prompt (plus het input-beeld bij
   image-to-image) gaat naar het beeldmodel met expliciete `aspectRatio` en
   `imageSize` in de generation-config.

Configureerbaar via env-vars (niet hardcoded):

| Variabele | Rol | Default |
| --- | --- | --- |
| `GEMINI_IMAGE_MODEL` | Beeldmodel | `gemini-3.1-flash-image-preview` |
| `GEMINI_IMAGE_MODEL_FALLBACK` | Fallback als het hoofdmodel ontbreekt | `gemini-2.5-flash-image` |
| `GEMINI_TEXT_MODEL` | Tekstmodel voor de rewrite-stap | `gemini-2.5-flash` |
| `GEMINI_IMAGE_SIZE` | Resolutie (`1K`/`2K`/`4K`) | `2K` |
| `ANTHROPIC_MODEL` | Caption-model | `claude-sonnet-4-6` |

De fine-tune-stap slaat de rewrite over (de strikte consistentie-instructie mag
niet verwaterd worden). Het effectieve beeldmodel wordt per call gelogd (zichtbaar
in de Vercel-functielogs), zodat je kan verifiëren welk model écht draaide.

> Beeldmodellen evolueren snel. Staat er bij Vercel nog een oude
> `GEMINI_IMAGE_MODEL` (bv. `gemini-2.5-flash-image`) ingesteld, verwijder of
> update die env-var, anders blijft het oude model draaien.

De app toont bovenaan een waarschuwing zolang een sleutel ontbreekt, en geeft
duidelijke foutmeldingen bij ongeldige sleutels of geblokkeerde generaties.

## Login (single-user)

De volledige app — pagina's én API-routes — is afgeschermd met een wachtwoord.
Stel `APP_PASSWORD` in (lokaal in `.env.local`, op Vercel als Environment
Variable) en log in op `/login`. Na een correcte login wordt een ondertekend,
`httpOnly` sessie-cookie gezet (HMAC met `APP_PASSWORD` als sleutel) dat niet te
vervalsen is. Een [`middleware`](src/middleware.ts) blokkeert elk verzoek zonder
geldige sessie, dus niemand kan beelden genereren zonder in te loggen. Uitloggen
kan rechtsboven in de app.

> Verander je `APP_PASSWORD`, dan worden alle bestaande sessies meteen ongeldig.

## Parameters voor variatie

Om je profiel gevarieerd te houden kies je per post: **ruimte**, **vastgoedtype**,
**stijl**, **licht/sfeer**, **beeldverhouding** en vrije **extra wensen**. De
knop **🎲 Verras me** zet willekeurige waarden. De keuzelijsten staan in
[`src/lib/options.ts`](src/lib/options.ts) en zijn vrij aan te passen.

Via **⚙︎ Instellingen** pas je de RFLCT-merkcontext/toon aan die aan Claude wordt
meegegeven, én — onder *Prompts aanpassen (geavanceerd)* — de volledige
AI-instructies voor elke stap. Schrijf ze als **vrije tekst**: geen placeholders
of accolades nodig. De relevante parameters (ruimte, vastgoedtype, stijl,
licht/sfeer, beeldverhouding, dienst, merk-context en je extra wensen) worden bij
het genereren automatisch als een contextblok onderaan de prompt toegevoegd. Elke
prompt heeft een *Herstel*-knop en wordt in de database bewaard.

### Twee diensten (bepaalt de "na"-foto)

Per post kies je welke RFLCT-dienst je uitlicht; dat bepaalt het "na"-resultaat:

- **Fotoretouche** — dezelfde ruimte, *niet* gerenoveerd en *geen nieuwe
  elementen*, maar wél opgeruimd, herschikt, professioneel belicht en
  gefotografeerd. De compositie/camerahoek mag wijzigen.
- **Virtual staging** — de ruimte mag volledig gerenoveerd en heringericht
  worden, maar de **compositie (camerahoek, kader) blijft exact gelijk** aan de
  voor-foto, zodat voor/na perfect overlappen.

Elke dienst heeft een eigen, apart bewerkbaar prompt-sjabloon.

### Instellingen bewaren (Vercel Postgres / Neon)

Je instellingen (merk-context/toon en je laatst gebruikte parameters) worden
opgeslagen in een **Neon Postgres**-database, zodat ze deployments overleven en
op al je toestellen gelijk zijn. Wijzigingen worden automatisch (gedebounced)
weggeschreven.

- Voeg op Vercel de **Neon**- of **Postgres**-integratie toe; die zet
  automatisch `DATABASE_URL` (of `POSTGRES_URL`). De app maakt zelf de tabel
  `app_settings` aan bij het eerste gebruik.
- Lokaal: plak de pooled connection string in `DATABASE_URL` in `.env.local`.
- Geen database ingesteld? Dan valt de app netjes terug op opslag in de browser
  (localStorage) — alles blijft werken, enkel niet gedeeld tussen toestellen.

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
