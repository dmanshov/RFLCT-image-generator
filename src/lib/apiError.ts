import { NextResponse } from "next/server";
import { ApiKeyError } from "./types";

/** Zet een fout om in een nette JSON-respons voor de client. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiKeyError) {
    return NextResponse.json(
      { error: err.message, kind: "api_key", provider: err.provider },
      { status: 400 }
    );
  }
  const message = err instanceof Error ? err.message : "Onbekende fout.";
  return NextResponse.json({ error: message, kind: "error" }, { status: 500 });
}
