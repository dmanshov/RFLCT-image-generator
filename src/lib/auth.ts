// Eenvoudige single-user authenticatie via een wachtwoord (APP_PASSWORD).
// Na een correcte login zetten we een httpOnly cookie met een HMAC-token dat
// niemand kan vervalsen zonder APP_PASSWORD te kennen. De middleware en de
// route handlers verifiëren dat token. Werkt zowel in de Node- als de
// Edge-runtime (gebruikt de Web Crypto API).

export const COOKIE_NAME = "rflct_session";
const SESSION_MESSAGE = "rflct-session-v1";

function getPassword(): string | null {
  const pw = process.env.APP_PASSWORD;
  return pw && pw.trim().length > 0 ? pw : null;
}

/** Is er een wachtwoord ingesteld? Zo niet, dan is login niet geconfigureerd. */
export function isAuthConfigured(): boolean {
  return getPassword() !== null;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Het verwachte sessie-token voor het ingestelde wachtwoord (of null). */
export async function sessionToken(): Promise<string | null> {
  const pw = getPassword();
  if (!pw) return null;
  return hmacHex(pw, SESSION_MESSAGE);
}

/** Constante-tijd vergelijking van twee strings van gelijke lengte. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Valideert het cookie-token tegen het verwachte token. */
export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await sessionToken();
  if (!expected) return false;
  return timingSafeEqual(token, expected);
}

/** Controleert of een ingegeven wachtwoord overeenkomt met APP_PASSWORD. */
export function passwordMatches(candidate: string): boolean {
  const pw = getPassword();
  if (!pw) return false;
  return timingSafeEqual(candidate, pw);
}
