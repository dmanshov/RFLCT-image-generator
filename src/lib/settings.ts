import { getSql } from "./db";
import { DEFAULT_BRAND_CONTEXT } from "./prompts";
import type { GenerationParams, InputMode } from "./types";

export interface AppSettings {
  brandContext: string;
  params?: Partial<GenerationParams>;
  mode?: InputMode;
}

// Single-user app: we bewaren één rij met id 'default'.
async function ensureTable(sql: NonNullable<ReturnType<typeof getSql>>) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id text PRIMARY KEY DEFAULT 'default',
      brand_context text NOT NULL DEFAULT '',
      params jsonb,
      mode text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

/** Laadt de instellingen uit de DB, of null als er geen DB geconfigureerd is. */
export async function loadSettings(): Promise<AppSettings | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureTable(sql);
  const rows = (await sql`
    SELECT brand_context, params, mode FROM app_settings WHERE id = 'default'
  `) as { brand_context: string; params: unknown; mode: string | null }[];

  if (rows.length === 0) {
    return { brandContext: DEFAULT_BRAND_CONTEXT };
  }
  const r = rows[0];
  return {
    brandContext: r.brand_context || DEFAULT_BRAND_CONTEXT,
    params: (r.params as Partial<GenerationParams>) ?? undefined,
    mode: (r.mode as InputMode) ?? undefined,
  };
}

/** Slaat de instellingen op (upsert). Werpt als er geen DB geconfigureerd is. */
export async function saveSettings(s: AppSettings): Promise<void> {
  const sql = getSql();
  if (!sql) {
    throw new Error("Geen database geconfigureerd (DATABASE_URL ontbreekt).");
  }
  await ensureTable(sql);
  const paramsJson = s.params ? JSON.stringify(s.params) : null;
  await sql`
    INSERT INTO app_settings (id, brand_context, params, mode, updated_at)
    VALUES ('default', ${s.brandContext}, ${paramsJson}::jsonb, ${s.mode ?? null}, now())
    ON CONFLICT (id) DO UPDATE
      SET brand_context = EXCLUDED.brand_context,
          params = EXCLUDED.params,
          mode = EXCLUDED.mode,
          updated_at = now()
  `;
}
