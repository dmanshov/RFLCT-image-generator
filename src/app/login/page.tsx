"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Inloggen mislukt.");
        return;
      }
      window.location.href = from;
    } catch {
      setError("Netwerkfout. Probeer opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold tracking-tight text-brand-900">RFLCT</h1>
        <p className="mb-5 text-sm text-brand-500">Log in om de generator te gebruiken.</p>

        <label className="field-label" htmlFor="password">
          Wachtwoord
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-accent mt-5 w-full" disabled={busy || !password}>
          {busy ? "Bezig…" : "Inloggen"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
