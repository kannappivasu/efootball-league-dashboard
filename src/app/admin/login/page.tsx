"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      const json = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};
      if (!res.ok) throw new Error(json.error ?? "Login failed");
      router.replace("/admin");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="card p-6">
        <h1 className="text-xl font-bold">Admin Login</h1>
        <p className="mt-1 text-sm text-slate-400">Only authorized admins can edit results.</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-3" autoComplete="off">
          <label className="block text-sm">
            <span className="text-slate-300">Email</span>
            <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label className="block text-sm">
            <span className="text-slate-300">Password</span>
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="text-sm text-red-400">⚠️ {error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
      <p className="mt-4 text-center text-xs text-slate-500">
        No account? Ask the super-admin to create one for you via the seed script.
      </p>
    </div>
  );
}
