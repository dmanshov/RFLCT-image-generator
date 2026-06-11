import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Verbindingsstring uit de Vercel/Neon-integratie. Vercel zet, afhankelijk van
// de integratie, een van deze variabelen. We proberen ze in volgorde.
function connectionString(): string | null {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

export function isDbConfigured(): boolean {
  return connectionString() !== null;
}

/** Geeft een Neon `sql`-tagfunctie terug, of null als er geen DB ingesteld is. */
export function getSql(): NeonQueryFunction<false, false> | null {
  const cs = connectionString();
  if (!cs) return null;
  return neon(cs);
}
