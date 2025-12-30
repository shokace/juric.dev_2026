"use client";

import { useEffect, useState } from "react";

type Props = {
  initialAuthenticated: boolean;
};

type SessionSource = "none" | "login" | "cookie";

export function LoginPanel({ initialAuthenticated }: Props) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [sessionSource, setSessionSource] = useState<SessionSource>(
    initialAuthenticated ? "cookie" : "none"
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Verify session on mount in case of existing cookie.
    const checkSession = async () => {
      try {
        const res = await fetch("/api/admin/login", { method: "GET", credentials: "same-origin" });
        if (!res.ok) return;
        const body = (await res.json()) as { authenticated?: boolean };
        if (body.authenticated) {
          setAuthenticated(true);
          setSessionSource("cookie");
          setStatus("Existing session found via cookie.");
        }
      } catch {
        // Ignore and fall back to login form.
      }
    };
    if (!initialAuthenticated) checkSession();
  }, [initialAuthenticated]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });

      const body = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !body.ok) {
        setError(body.error || "Login failed");
        setAuthenticated(false);
        setSessionSource("none");
        return;
      }

      setAuthenticated(true);
      setSessionSource("login");
      setStatus(null);
      setPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-white">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Admin login</h1>
        <p className="text-sm text-white/70">
          Enter your admin password to start a session.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm text-white/80">
          Password
          <input
            type="password"
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-emerald-300/60"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={loading}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {authenticated && (
        <div className="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          <div className="font-semibold">Session active.</div>
          <div>You can safely close this tab and stay signed in for a year.</div>
          {sessionSource === "cookie" && (
            <div className="mt-2 text-emerald-50/80">Verified existing session from stored cookie.</div>
          )}
        </div>
      )}
      {status && !authenticated && (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          {status}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
