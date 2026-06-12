"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ASPECTS,
  LIGHTING,
  PROPERTY_TYPES,
  ROOM_TYPES,
  SERVICES,
  STYLES,
  randomParams,
} from "@/lib/options";
import { DEFAULT_BRAND_CONTEXT, DEFAULT_PROMPTS, type PromptKey, type PromptSet } from "@/lib/prompts";
import type { GenerationParams, InputMode } from "@/lib/types";

type Stage = "before" | "after" | "caption";
type StageState = "idle" | "busy" | "done" | "error";

const DEFAULT_PARAMS: GenerationParams = {
  roomType: ROOM_TYPES[0],
  propertyType: PROPERTY_TYPES[0],
  style: STYLES[0],
  lighting: LIGHTING[0],
  aspect: "4:5",
  service: "retouch",
  extra: "",
};

// Welke prompt-sjablonen in de instellingen bewerkbaar zijn.
const PROMPT_FIELDS: { key: PromptKey; label: string; hint: string }[] = [
  { key: "beforeParams", label: "Voor-foto · uit parameters", hint: "Ruimte, vastgoedtype, stijl, beeldverhouding en extra wensen worden automatisch toegevoegd." },
  { key: "beforeReference", label: "Voor-foto · uit referentie (URL/upload)", hint: "De referentiefoto en je extra wensen worden automatisch meegegeven." },
  { key: "afterStaging", label: "Na-foto · virtual staging (renovatie)", hint: "Licht/sfeer en extra wensen worden automatisch toegevoegd." },
  { key: "afterRetouch", label: "Na-foto · fotoretouche", hint: "Licht/sfeer, beeldverhouding en extra wensen worden automatisch toegevoegd." },
  { key: "caption", label: "Caption · Claude", hint: "Merk-context, ruimte en dienst worden automatisch toegevoegd; het JSON-formaat dwingt de app af." },
];

interface ApiError {
  error: string;
  kind?: string;
  provider?: string;
}

// Verkleint een data-URL naar een redelijke max-afmeting en exporteert als JPEG.
// Gebruikt om de payload klein te houden (Vercel-limiet ~4,5 MB), bv. wanneer we
// twee beelden naar de caption-stap sturen.
async function downscaleDataUrl(dataUrl: string, maxDim = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export default function Page() {
  const [mode, setMode] = useState<InputMode>("params");
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS);
  const [url, setUrl] = useState("");
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>("");
  const [brandContext, setBrandContext] = useState(DEFAULT_BRAND_CONTEXT);
  const [prompts, setPrompts] = useState<PromptSet>(DEFAULT_PROMPTS);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);

  const [beforeImg, setBeforeImg] = useState<string | null>(null);
  const [afterImg, setAfterImg] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [toelichting, setToelichting] = useState("");

  const [stage, setStage] = useState<Record<Stage, StageState>>({
    before: "idle",
    after: "idle",
    caption: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [health, setHealth] = useState<{ gemini: boolean; anthropic: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "local" | "error">("idle");

  const running = Object.values(stage).some((s) => s === "busy");
  // Pas met opslaan beginnen nadat de instellingen (DB of cache) geladen zijn,
  // zodat we de net geladen waarden niet meteen terugschrijven.
  const ready = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── instellingen laden: eerst lokale cache, dan autoritatief uit de DB ─────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rflct:prefs");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.params) setParams({ ...DEFAULT_PARAMS, ...p.params });
        if (typeof p.brandContext === "string") setBrandContext(p.brandContext);
        if (p.mode) setMode(p.mode);
        if (p.prompts) setPrompts({ ...DEFAULT_PROMPTS, ...p.prompts });
      }
    } catch {
      /* ignore */
    }

    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d?.persisted && d.settings) {
          if (typeof d.settings.brandContext === "string") setBrandContext(d.settings.brandContext);
          if (d.settings.params) setParams((p) => ({ ...DEFAULT_PARAMS, ...p, ...d.settings.params }));
          if (d.settings.mode) setMode(d.settings.mode);
          if (d.settings.prompts) setPrompts((pr) => ({ ...DEFAULT_PROMPTS, ...pr, ...d.settings.prompts }));
        }
      })
      .catch(() => {
        /* DB onbereikbaar → we blijven op lokale cache draaien */
      })
      .finally(() => {
        ready.current = true;
      });
  }, []);

  // ── instellingen opslaan: lokale cache direct + gedebouncede DB-save ───────
  useEffect(() => {
    try {
      localStorage.setItem("rflct:prefs", JSON.stringify({ params, brandContext, mode, prompts }));
    } catch {
      /* ignore */
    }
    if (!ready.current) return;

    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandContext, params, mode, prompts }),
        });
        if (res.ok) setSaveState("saved");
        else if (res.status === 503) setSaveState("local");
        else if (res.status === 401) window.location.href = "/login";
        else setSaveState("error");
      } catch {
        setSaveState("error");
      }
    }, 800);
  }, [params, brandContext, mode, prompts]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const setParam = <K extends keyof GenerationParams>(k: K, v: GenerationParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDataUrl(reader.result as string);
      setUploadName(file.name);
    };
    reader.readAsDataURL(file);
  };

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Lees als tekst en probeer JSON te parsen. Sommige fouten (bv. een te grote
    // payload → 413) geven een lege of niet-JSON body terug; res.json() zou dan
    // in Safari falen met "The string did not match the expected pattern.".
    const text = await res.text();
    let data: (Partial<ApiError> & Record<string, unknown>) | null = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 401 && data?.kind === "auth") {
        window.location.href = "/login";
      }
      const message =
        (data?.error as string) ||
        (res.status === 413
          ? "De afbeeldingen zijn te groot voor de server (limiet ~4,5 MB). Probeer opnieuw — de beelden worden nu automatisch verkleind voor de caption."
          : `Server gaf een fout (${res.status}).`);
      throw new Error(message);
    }
    if (!data) {
      throw new Error("Onverwacht antwoord van de server (geen geldige JSON).");
    }
    return data as T;
  }

  const runBefore = useCallback(async (): Promise<string> => {
    setStage((s) => ({ ...s, before: "busy" }));
    try {
      const { image } = await postJson<{ image: string }>("/api/before", {
        mode,
        params,
        url: mode === "url" ? url : undefined,
        uploadDataUrl: mode === "upload" ? uploadDataUrl : undefined,
        promptTemplate: mode === "params" ? prompts.beforeParams : prompts.beforeReference,
      });
      setBeforeImg(image);
      setStage((s) => ({ ...s, before: "done" }));
      return image;
    } catch (e) {
      setStage((s) => ({ ...s, before: "error" }));
      throw e;
    }
  }, [mode, params, url, uploadDataUrl, prompts]);

  const runAfter = useCallback(
    async (before: string): Promise<string> => {
      setStage((s) => ({ ...s, after: "busy" }));
      try {
        const { image } = await postJson<{ image: string }>("/api/after", {
          params,
          beforeDataUrl: before,
          promptTemplate: params.service === "staging" ? prompts.afterStaging : prompts.afterRetouch,
        });
        setAfterImg(image);
        setStage((s) => ({ ...s, after: "done" }));
        return image;
      } catch (e) {
        setStage((s) => ({ ...s, after: "error" }));
        throw e;
      }
    },
    [params, prompts]
  );

  const runCaption = useCallback(
    async (before: string, after: string) => {
      setStage((s) => ({ ...s, caption: "busy" }));
      try {
        // Verklein beide beelden voor de caption: Claude heeft geen volledige
        // resolutie nodig en zo blijven we ruim onder de payload-limiet.
        const [beforeSmall, afterSmall] = await Promise.all([
          downscaleDataUrl(before),
          downscaleDataUrl(after),
        ]);
        const data = await postJson<{ caption: string; toelichting: string }>("/api/caption", {
          params,
          beforeDataUrl: beforeSmall,
          afterDataUrl: afterSmall,
          brandContext,
          promptTemplate: prompts.caption,
        });
        setCaption(data.caption);
        setToelichting(data.toelichting);
        setStage((s) => ({ ...s, caption: "done" }));
      } catch (e) {
        setStage((s) => ({ ...s, caption: "error" }));
        throw e;
      }
    },
    [params, brandContext, prompts]
  );

  // Fase 1: enkel de "voor"-foto genereren. De "na"-foto (en caption) volgen
  // pas na expliciete goedkeuring, om Gemini-credits te besparen.
  const generateBefore = async () => {
    setError(null);
    setBeforeImg(null);
    setAfterImg(null);
    setCaption("");
    setToelichting("");
    setStage({ before: "idle", after: "idle", caption: "idle" });
    try {
      await runBefore();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Fase 2: na goedkeuring van de "voor"-foto → "na"-foto + caption.
  const approveAndContinue = async () => {
    if (!beforeImg) return;
    setError(null);
    try {
      const after = await runAfter(beforeImg);
      await runCaption(beforeImg, after);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Losse hergeneratie-acties.
  const regenAfter = async () => {
    if (!beforeImg) return;
    setError(null);
    try {
      const after = await runAfter(beforeImg);
      await runCaption(beforeImg, after);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const regenCaption = async () => {
    if (!beforeImg || !afterImg) return;
    setError(null);
    try {
      await runCaption(beforeImg, afterImg);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Fine-tune: neem het reeds gegenereerde beeld als basis en pas enkel de
  // meegegeven instructie toe. Vervangt het betreffende beeld bij succes.
  const fineTune = async (which: "before" | "after", instruction: string): Promise<boolean> => {
    const current = which === "before" ? beforeImg : afterImg;
    if (!current || !instruction.trim()) return false;
    setError(null);
    try {
      const { image } = await postJson<{ image: string }>("/api/finetune", {
        image: current,
        instruction,
      });
      if (which === "before") setBeforeImg(image);
      else setAfterImg(image);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const surprise = () => setParams((p) => ({ ...p, ...randomParams() }));

  const logout = async () => {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {
      /* negeer */
    }
    window.location.href = "/login";
  };

  const canGenerate =
    !running &&
    (mode === "params" ||
      (mode === "url" && url.trim().length > 0) ||
      (mode === "upload" && Boolean(uploadDataUrl)));

  // De "voor"-foto staat klaar en wacht op goedkeuring vóór de "na"-stap.
  const awaitingApproval =
    Boolean(beforeImg) && stage.before === "done" && stage.after === "idle";

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Kon niet naar het klembord kopiëren (browser blokkeert dit mogelijk).");
    }
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-900">
            RFLCT · Vastgoedfoto Generator
          </h1>
          <p className="text-sm text-brand-500">
            Genereer een voor/na-reeks + Nederlandse caption voor je socials.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setShowSettings((v) => !v)}>
            ⚙︎ Instellingen
          </button>
          <button className="btn-ghost" onClick={logout}>
            ⎋ Uitloggen
          </button>
        </div>
      </header>

      {health && (!health.gemini || !health.anthropic) && (
        <div className="card mb-5 border-accent-400 bg-amber-50 p-4 text-sm text-brand-800">
          <strong>Let op — API-sleutels ontbreken.</strong>{" "}
          {!health.gemini && "De Gemini-sleutel (beeld) is niet ingesteld. "}
          {!health.anthropic && "De Anthropic-sleutel (caption) is niet ingesteld. "}
          Voeg ze toe in <code className="rounded bg-white px-1">.env.local</code> (zie{" "}
          <code className="rounded bg-white px-1">.env.example</code>) en herstart de app.
        </div>
      )}

      {showSettings && (
        <div className="card mb-5 p-4">
          <div className="mb-1 flex items-center justify-between">
            <label className="field-label mb-0">
              RFLCT merk-context & toon (wordt aan Claude meegegeven)
            </label>
            <SaveBadge state={saveState} />
          </div>
          <textarea
            className="field min-h-[120px]"
            value={brandContext}
            onChange={(e) => setBrandContext(e.target.value)}
          />
          <button className="btn-ghost mt-2" onClick={() => setBrandContext(DEFAULT_BRAND_CONTEXT)}>
            Herstel standaardtekst
          </button>
          <p className="mt-2 text-xs text-brand-400">
            Wijzigingen worden automatisch opgeslagen in de database (Vercel/Neon) en gelden op al je
            toestellen. Zonder database vallen we terug op opslag in deze browser.
          </p>

          <div className="mt-5 border-t border-brand-200 pt-4">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowPrompts((v) => !v)}
            >
              <span className="text-sm font-semibold text-brand-900">
                Prompts aanpassen (geavanceerd)
              </span>
              <span className="text-brand-400">{showPrompts ? "▲" : "▼"}</span>
            </button>

            {showPrompts && (
              <div className="mt-3 space-y-5">
                <p className="text-xs text-brand-400">
                  Schrijf je prompts als vrije tekst — géén placeholders of accolades nodig. De
                  relevante parameters (ruimte, stijl, licht, beeldverhouding, dienst, merk-context
                  en je extra wensen) worden automatisch onderaan de prompt toegevoegd. Wijzigingen
                  worden mee opgeslagen in de database.
                </p>
                {PROMPT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="field-label mb-0">{f.label}</label>
                      <button
                        className="btn-ghost px-2 py-0.5 text-[11px]"
                        onClick={() => setPrompts((p) => ({ ...p, [f.key]: DEFAULT_PROMPTS[f.key] }))}
                      >
                        Herstel
                      </button>
                    </div>
                    <textarea
                      className="field min-h-[140px] font-mono text-xs leading-relaxed"
                      value={prompts[f.key]}
                      onChange={(e) => setPrompts((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                    <p className="mt-1 text-[11px] text-brand-400">{f.hint}</p>
                  </div>
                ))}
                <button
                  className="btn-ghost"
                  onClick={() => setPrompts(DEFAULT_PROMPTS)}
                >
                  Herstel alle prompts naar standaard
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ── Bedieningspaneel ── */}
        <section className="card h-fit p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-500">
            1 · Vertrekpunt
          </h2>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-brand-100 p-1">
            {(
              [
                ["params", "Parameters"],
                ["url", "URL"],
                ["upload", "Upload"],
              ] as [InputMode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? "bg-white text-brand-900 shadow-sm" : "text-brand-500 hover:text-brand-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "url" && (
            <div className="mb-4">
              <label className="field-label">Link naar referentiefoto (Immoweb/Zimmo)</label>
              <input
                className="field"
                placeholder="https://…/foto.jpg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-brand-400">
                Geef de directe link naar de afbeelding. Er wordt een originele, copyright-veilige
                gelijkaardige ruimte gegenereerd.
              </p>
            </div>
          )}

          {mode === "upload" && (
            <div className="mb-4">
              <label className="field-label">Referentiefoto uploaden</label>
              <input
                type="file"
                accept="image/*"
                className="field"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              {uploadDataUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadDataUrl} alt="referentie" className="h-14 w-14 rounded object-cover" />
                  <span className="text-xs text-brand-500">{uploadName}</span>
                </div>
              )}
            </div>
          )}

          {mode === "params" && (
            <p className="mb-4 text-xs text-brand-400">
              Geen referentie nodig — de "voor"-foto wordt volledig uit onderstaande parameters
              gegenereerd.
            </p>
          )}

          <div className="mb-4">
            <label className="field-label">Dienst (bepaalt de "na"-foto)</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setParam("service", s.value)}
                  className={`rounded-lg border p-2 text-left transition-colors ${
                    params.service === s.value
                      ? "border-accent-400 bg-amber-50 ring-1 ring-accent-400"
                      : "border-brand-200 bg-white hover:bg-brand-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-brand-900">{s.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-brand-500">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-500">
              2 · Parameters
            </h2>
            <button className="btn-ghost px-2 py-1 text-xs" onClick={surprise} disabled={running}>
              🎲 Verras me
            </button>
          </div>

          <div className="space-y-3">
            <Select label="Ruimte" value={params.roomType} onChange={(v) => setParam("roomType", v)} options={ROOM_TYPES} />
            <Select label="Vastgoedtype" value={params.propertyType} onChange={(v) => setParam("propertyType", v)} options={PROPERTY_TYPES} />
            <Select label="Stijl" value={params.style} onChange={(v) => setParam("style", v)} options={STYLES} />
            <Select label="Licht / sfeer (na)" value={params.lighting} onChange={(v) => setParam("lighting", v)} options={LIGHTING} />
            <div>
              <label className="field-label">Beeldverhouding</label>
              <select className="field" value={params.aspect} onChange={(e) => setParam("aspect", e.target.value)}>
                {ASPECTS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Extra wensen (optioneel)</label>
              <input
                className="field"
                placeholder="bv. uitzicht op zee, planten, parket…"
                value={params.extra ?? ""}
                onChange={(e) => setParam("extra", e.target.value)}
              />
            </div>
          </div>

          <button className="btn-accent mt-5 w-full" onClick={generateBefore} disabled={!canGenerate}>
            {stage.before === "busy" ? "Bezig…" : "✨ Genereer 'voor'-foto"}
          </button>
          <p className="mt-2 text-center text-[11px] text-brand-400">
            Stap 1 verbruikt 1 beeld-credit. De "na"-foto genereer je pas na jouw
            goedkeuring.
          </p>

          <ProgressList stage={stage} />
        </section>

        {/* ── Resultaten ── */}
        <section className="space-y-6">
          {error && (
            <div className="card border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          {awaitingApproval && (
            <div className="card border-accent-400 bg-amber-50 p-4">
              <p className="text-sm font-medium text-brand-800">
                Tevreden met de "voor"-foto? Keur ze goed om de "na"-foto + caption te
                genereren. Dit verbruikt extra Gemini-credits.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-accent" onClick={approveAndContinue} disabled={running}>
                  ✓ Goedkeuren → genereer "na" + caption
                </button>
                <button className="btn-ghost" onClick={generateBefore} disabled={running}>
                  ↻ Nieuwe "voor"-foto
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <ResultCard
              title="Voor"
              badge="Matige advertentiefoto"
              image={beforeImg}
              busy={stage.before === "busy"}
              filenameBase="rflct-voor"
              onRegen={generateBefore}
              regenLabel="Nieuwe 'voor'"
              regenDisabled={running || !canGenerate}
              onFineTune={(instr) => fineTune("before", instr)}
              fineTuneDisabled={running}
            />
            <ResultCard
              title="Na"
              badge="Professioneel · RFLCT"
              image={afterImg}
              busy={stage.after === "busy"}
              filenameBase="rflct-na"
              onRegen={regenAfter}
              regenLabel="Nieuwe 'na'"
              regenDisabled={running || !beforeImg}
              onFineTune={(instr) => fineTune("after", instr)}
              fineTuneDisabled={running}
              highlight
            />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-500">
                3 · Caption
              </h3>
              <div className="flex gap-2">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={regenCaption} disabled={running || !afterImg}>
                  ↻ Opnieuw
                </button>
                <button className="btn-primary px-3 py-1 text-xs" onClick={copyCaption} disabled={!caption}>
                  {copied ? "✓ Gekopieerd" : "📋 Kopieer caption"}
                </button>
              </div>
            </div>
            {stage.caption === "busy" ? (
              <div className="animate-pulse text-sm text-brand-400">Caption wordt geschreven…</div>
            ) : caption ? (
              <>
                <textarea
                  className="field min-h-[140px] font-medium leading-relaxed"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                {toelichting && (
                  <p className="mt-3 rounded-lg bg-brand-50 p-3 text-xs text-brand-600">
                    <strong>Toelichting (voor jezelf):</strong> {toelichting}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-brand-400">
                Nog geen caption. Start een generatie om voor/na-beelden en een caption te krijgen.
              </p>
            )}
          </div>
        </section>
      </div>

      <footer className="mt-10 text-center text-xs text-brand-400">
        RFLCT · beelden via Google Gemini, caption via Anthropic Claude. Controleer beelden steeds op realisme voor je post.
      </footer>
    </main>
  );
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "local" | "error" }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Opslaan…", cls: "text-brand-400" },
    saved: { text: "✓ Opgeslagen in database", cls: "text-emerald-600" },
    local: { text: "Lokaal opgeslagen (geen database)", cls: "text-accent-600" },
    error: { text: "✕ Opslaan mislukt", cls: "text-red-600" },
  } as const;
  const { text, cls } = map[state];
  return <span className={`text-xs font-medium ${cls}`}>{text}</span>;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProgressList({ stage }: { stage: Record<Stage, StageState> }) {
  const rows: [Stage, string][] = [
    ["before", "Voor-foto genereren"],
    ["after", "Professionele na-foto"],
    ["caption", "Caption schrijven"],
  ];
  const icon = (s: StageState) =>
    s === "done" ? "✓" : s === "busy" ? "●" : s === "error" ? "✕" : "○";
  const color = (s: StageState) =>
    s === "done"
      ? "text-emerald-600"
      : s === "busy"
      ? "text-accent-600 animate-pulse"
      : s === "error"
      ? "text-red-600"
      : "text-brand-300";
  if (rows.every(([k]) => stage[k] === "idle")) return null;
  return (
    <ul className="mt-4 space-y-1 text-sm">
      {rows.map(([k, label]) => (
        <li key={k} className="flex items-center gap-2">
          <span className={`w-4 text-center font-bold ${color(stage[k])}`}>{icon(stage[k])}</span>
          <span className={stage[k] === "idle" ? "text-brand-400" : "text-brand-700"}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({
  title,
  badge,
  image,
  busy,
  filenameBase,
  onRegen,
  regenLabel,
  regenDisabled,
  onFineTune,
  fineTuneDisabled,
  highlight,
}: {
  title: string;
  badge: string;
  image: string | null;
  busy: boolean;
  filenameBase: string;
  onRegen: () => void;
  regenLabel: string;
  regenDisabled: boolean;
  onFineTune: (instruction: string) => Promise<boolean>;
  fineTuneDisabled: boolean;
  highlight?: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  const [ftBusy, setFtBusy] = useState(false);

  const runFineTune = async () => {
    if (!instruction.trim()) return;
    setFtBusy(true);
    const ok = await onFineTune(instruction);
    setFtBusy(false);
    if (ok) setInstruction("");
  };

  const download = () => {
    if (!image) return;
    const ext = image.startsWith("data:image/jpeg") ? "jpg" : "png";
    const a = document.createElement("a");
    a.href = image;
    a.download = `${filenameBase}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className={`card overflow-hidden ${highlight ? "ring-2 ring-accent-400" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <span className="text-sm font-semibold text-brand-900">{title}</span>
          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-500">
            {badge}
          </span>
        </div>
      </div>
      <div className="relative aspect-[4/5] w-full bg-brand-100">
        {busy || ftBusy ? (
          <div className="flex h-full items-center justify-center">
            <span className="animate-pulse text-sm text-brand-400">
              {ftBusy ? "Bijwerken…" : "Genereren…"}
            </span>
          </div>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-brand-300">
            Nog geen beeld
          </div>
        )}
      </div>
      <div className="flex gap-2 p-3">
        <button className="btn-primary flex-1" onClick={download} disabled={!image}>
          ⬇︎ Download
        </button>
        <button className="btn-ghost" onClick={onRegen} disabled={regenDisabled}>
          ↻ {regenLabel}
        </button>
      </div>

      {image && (
        <div className="border-t border-brand-100 px-3 pb-3 pt-2">
          <label className="field-label">Fine-tunen (enkel wat je hier vraagt wijzigt)</label>
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="bv. maak het wat lichter, verwijder de stoel links…"
              value={instruction}
              disabled={ftBusy || fineTuneDisabled}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runFineTune();
              }}
            />
            <button
              className="btn-accent"
              onClick={runFineTune}
              disabled={ftBusy || fineTuneDisabled || !instruction.trim()}
            >
              {ftBusy ? "…" : "Pas toe"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-brand-400">
            Vertrekt van dit beeld en houdt al de rest consistent. Verbruikt 1 Gemini-credit.
          </p>
        </div>
      )}
    </div>
  );
}
