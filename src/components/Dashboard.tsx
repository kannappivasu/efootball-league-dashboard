"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initialsAvatar } from "@/lib/avatar";
import type { StandingsRow } from "@/lib/standings";

type MatchData = {
  id: string;
  homePlayerId: string;
  awayPlayerId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  leg: string;
  playedAt: string | null;
  homePlayer: { id: string; name: string; avatar: string | null };
  awayPlayer: { id: string; name: string; avatar: string | null };
};

type PlayerData = { id: string; name: string; avatar: string | null };

type DataShape = {
  players: PlayerData[];
  matches: MatchData[];
  standings: StandingsRow[];
  lastUpdated: string | null;
  generatedAt: string;
  count: { players: number; matches: number };
};

const POLL_MS = 8000;

export default function Dashboard() {
  const [data, setData] = useState<DataShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const previousStandingsRef = useRef(new Map<string, string>());
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DataShape = await res.json();

      const nextStandings = new Map(
        json.standings.map((row) => [row.playerId, `${row.pts}:${row.gf}:${row.ga}`])
      );
      const changed = new Set<string>();
      for (const [playerId, nextValue] of nextStandings) {
        const previousValue = previousStandingsRef.current.get(playerId);
        if (previousValue && previousValue !== nextValue) changed.add(playerId);
      }
      if (changed.size) {
        setFlashIds(changed);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 1500);
      }
      previousStandingsRef.current = nextStandings;
      setData(json);
      setError(null);
      setLastFetchedAt(Date.now());
      setNow(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const pollInterval = setInterval(() => void fetchData(true), POLL_MS);
    const clockInterval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [fetchData]);

  const secondsAgo = lastFetchedAt == null ? 0 : Math.max(0, Math.floor((now - lastFetchedAt) / 1000));

  if (error && !data) {
    return <div className="card p-8 text-center text-slate-300">Could not load league data. <button className="btn-ghost mt-4" onClick={() => void fetchData()}>Retry</button></div>;
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  const completed = data.matches.filter((m) => m.status === "completed")
    .sort((a, b) => new Date(b.playedAt ?? 0).getTime() - new Date(a.playedAt ?? 0).getTime());
  const upcoming = data.matches.filter((m) => m.status === "scheduled")
    .sort((a, b) => (a.homePlayer.name.localeCompare(b.homePlayer.name)));

  const played = completed.length;
  const total = data.matches.length;
  const remaining = total - played;
  const goals = completed.reduce((sum, match) => sum + (match.homeGoals ?? 0) + (match.awayGoals ?? 0), 0);
  const completion = total ? Math.round((played / total) * 100) : 0;
  const leader = data.standings[0];
  const topScorer = played ? [...data.standings].sort((a, b) => b.gf - a.gf || b.pts - a.pts)[0] : undefined;
  const bestGd = played ? [...data.standings].sort((a, b) => b.gd - a.gd || b.pts - a.pts)[0] : undefined;

  return (
    <div className="space-y-7">
      <p
        aria-hidden="true"
        className="select-none text-center text-[4px] leading-none tracking-[0.08em] text-slate-950/30"
      >
        sam is a little vanam
      </p>
      <section className="hero-card">
        <span className="hero-orb hero-orb-one" />
        <span className="hero-orb hero-orb-two" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_260px] lg:items-center">
          <div>
            <span className="eyebrow">
              <span className={`h-1.5 w-1.5 rounded-full ${refreshing ? "animate-ping bg-pitch-300" : "bg-pitch-400"}`} />
              Live league
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Every match. Every point. <span className="text-gradient">One league.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              Standings, form and every fixture in one place. Results refresh automatically as the league unfolds.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Live standings", "Recent form", "Full fixtures"].map((label) => (
                <span key={label} className="feature-pill">{label}</span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-pitch-400" />
                {refreshing ? "Refreshing…" : `Synced ${secondsAgo}s ago`}
              </span>
              <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void fetchData()}>
                Refresh now
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center lg:justify-end">
            <div
              className="grid h-44 w-44 place-items-center rounded-full p-3 shadow-2xl shadow-pitch-950/70"
              style={{ background: `conic-gradient(#22c55e ${completion * 3.6}deg, rgba(51,65,85,.45) 0deg)` }}
            >
              <div className="grid h-full w-full place-items-center rounded-full border border-white/[0.08] bg-slate-950/95 text-center">
                <div>
                  <p className="text-4xl font-black tracking-tight">{completion}%</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">complete</p>
                  <p className="mt-2 text-xs text-slate-400">{played} of {total}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="card border-red-800/60 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}

      <OverviewStats
        players={data.players.length}
        remaining={remaining}
        goals={goals}
        leader={leader}
      />

      <Highlights topScorer={topScorer} bestGd={bestGd} />

      <StandingsTable rows={data.standings} flashIds={flashIds} />

      <FixturesSection completed={completed} upcoming={upcoming} />
    </div>
  );
}

function OverviewStats({
  players,
  remaining,
  goals,
  leader,
}: {
  players: number;
  remaining: number;
  goals: number;
  leader?: StandingsRow;
}) {
  const stats = [
    { label: "Players", value: players, detail: "in the league" },
    { label: "Goals", value: goals, detail: "scored so far" },
    { label: "Remaining", value: remaining, detail: "fixtures left" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <span className="absolute right-3 top-3 h-8 w-8 rounded-full bg-pitch-500/10 blur-xl" />
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{stat.value}</p>
          <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
        </div>
      ))}
      <div className="stat-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Current leader</p>
        {leader ? (
          <div className="mt-2 flex items-center gap-3">
            <img src={initialsAvatar(leader.name, leader.avatar)} alt="" className="h-10 w-10 rounded-xl ring-1 ring-white/10" />
            <div className="min-w-0">
              <p className="truncate font-bold">{leader.name}</p>
              <p className="text-xs text-pitch-400">{leader.pts} points</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Waiting for players</p>
        )}
      </div>
    </div>
  );
}

function Highlights({ topScorer, bestGd }: { topScorer?: StandingsRow; bestGd?: StandingsRow }) {
  if (!topScorer && !bestGd) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card flex items-center gap-4 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-400/10 text-xl text-amber-300">★</div>
        <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-slate-400">Top Scorer</p>
        <p className="mt-1 flex items-center gap-2 font-bold">
          <span className="truncate">{topScorer?.name ?? "—"}</span>
          <span className="ml-auto text-xl text-pitch-400">{topScorer?.gf ?? 0}</span>
        </p>
        </div>
      </div>
      <div className="card flex items-center gap-4 p-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-pitch-400/10 text-lg font-black text-pitch-300">±</div>
        <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-slate-400">Best Goal Difference</p>
        <p className="mt-1 flex items-center gap-2 font-bold">
          <span className="truncate">{bestGd?.name ?? "—"}</span>
          <span className={`ml-auto text-xl ${bestGd && bestGd.gd > 0 ? "text-pitch-400" : "text-slate-400"}`}>{bestGd ? (bestGd.gd > 0 ? `+${bestGd.gd}` : bestGd.gd) : "—"}</span>
        </p>
        </div>
      </div>
    </div>
  );
}

function StandingsTable({ rows, flashIds }: { rows: StandingsRow[]; flashIds: Set<string> }) {
  const CUTOFF = 4;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pitch-400">Competition</p>
          <h2 className="mt-0.5 text-lg font-extrabold">League table</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="h-2 w-2 rounded-full bg-pitch-500" />
          Top four
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-300">
            <tr className="text-xs uppercase tracking-wide">
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Player</th>
              <th className="px-2 py-3 text-center">MP</th>
              <th className="px-2 py-3 text-center">W</th>
              <th className="px-2 py-3 text-center">D</th>
              <th className="px-2 py-3 text-center">L</th>
              <th className="px-2 py-3 text-center">GF</th>
              <th className="px-2 py-3 text-center">GA</th>
              <th className="px-2 py-3 text-center">GD</th>
              <th className="px-2 py-3 text-center text-pitch-400">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                  No players yet. An admin can add the first player.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const top = i < CUTOFF;
              const zebra = i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/10";
              const flash = flashIds.has(r.playerId);
              return (
                <tr key={r.playerId} className={`border-t border-white/[0.05] transition hover:bg-white/[0.035] ${zebra} ${flash ? "animate-pulseRow" : ""}`}>
                  <td className="px-3 py-2.5">
                    <span className={`grid h-6 w-6 place-items-center rounded-md text-xs font-bold ${top ? "bg-pitch-600 text-white" : "bg-slate-800 text-slate-300"}`}>{i + 1}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <img src={initialsAvatar(r.name, r.avatar)} alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/10" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{r.name}</span>
                        <Form form={r.form} />
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-slate-300">{r.mp}</td>
                  <td className="px-2 py-2.5 text-center text-slate-200">{r.w}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.d}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.l}</td>
                  <td className="px-2 py-2.5 text-center text-slate-300">{r.gf}</td>
                  <td className="px-2 py-2.5 text-center text-slate-400">{r.ga}</td>
                  <td className="px-2 py-2.5 text-center text-slate-200">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="px-2 py-2.5 text-center font-extrabold text-pitch-400">{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Form({ form }: { form: ("W"|"D"|"L")[] }) {
  if (!form.length) return null;
  return (
    <span className="hidden sm:inline-flex gap-0.5">
      {form.map((r, i) => (
        <span key={i} className={`grid h-4 w-4 place-items-center rounded text-[10px] font-bold text-white ${r === "W" ? "bg-pitch-600" : r === "D" ? "bg-slate-500" : "bg-red-600/80"}`}>{r}</span>
      ))}
    </span>
  );
}

function FixturesSection({ completed, upcoming }: { completed: MatchData[]; upcoming: MatchData[] }) {
  return (
    <section>
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pitch-400">Match centre</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">Fixtures & results</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
      <FixtureList title="Played" matches={completed} />
      <FixtureList title="Upcoming" matches={upcoming} />
      </div>
    </section>
  );
}

function FixtureList({ title, matches }: { title: string; matches: MatchData[] }) {
  const played = title === "Played";
  const initialLimit = played ? 10 : 12;
  const [expanded, setExpanded] = useState(false);
  const visibleMatches = expanded ? matches : matches.slice(0, initialLimit);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${played ? "bg-slate-500" : "bg-pitch-400 shadow-[0_0_16px_rgba(74,222,128,.7)]"}`} />
          <h3 className="text-lg font-bold">{played ? "Recent results" : "Upcoming fixtures"}</h3>
        </div>
        <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-bold text-slate-400">{matches.length}</span>
      </div>
      <div className="p-3 sm:p-4">
      {matches.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No {played ? "completed" : "scheduled"} matches yet.</p>
      ) : (
        <ul className="space-y-2">
          {visibleMatches.map((m) => {
            const homeG = m.homeGoals != null ? m.homeGoals : "—";
            const awayG = m.awayGoals != null ? m.awayGoals : "—";
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-slate-950/35 p-3 transition hover:border-white/[0.12] hover:bg-slate-900/60 sm:gap-3">
                <div className="flex flex-1 items-center justify-end gap-2 text-right">
                  <span className={`truncate ${homeG > awayG && played ? "font-bold text-slate-100" : "text-slate-300"}`}>{m.homePlayer.name}</span>
                  <img src={initialsAvatar(m.homePlayer.name, m.homePlayer.avatar)} alt="" className="h-7 w-7 rounded-lg ring-1 ring-white/10" />
                  <LegTag home />
                </div>
                <div className="flex flex-col items-center px-2">
                  {played ? (
                    <span className="grid min-w-[3.25rem] place-items-center rounded-lg border border-white/[0.07] bg-slate-950 px-2 py-1 text-lg font-black tabular-nums">{homeG}:{awayG}</span>
                  ) : (
                    <span className="grid min-w-[3.25rem] place-items-center rounded-lg border border-pitch-500/20 bg-pitch-500/[0.05] px-2 py-1 text-xs font-black uppercase tracking-wider text-pitch-300">vs</span>
                  )}
                </div>
                <LegTag home={false} />
                <img src={initialsAvatar(m.awayPlayer.name, m.awayPlayer.avatar)} alt="" className="h-7 w-7 rounded-lg ring-1 ring-white/10" />
                <div className="flex flex-1 items-center gap-2">
                  <span className={`truncate ${awayG > homeG && played ? "font-bold text-slate-100" : "text-slate-300"}`}>{m.awayPlayer.name}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {matches.length > initialLimit && (
        <button
          className="btn-ghost mt-3 w-full !py-1.5 text-xs"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show fewer" : `Show all ${matches.length}`}
        </button>
      )}
      </div>
    </div>
  );
}

function LegTag({ home }: { home: boolean }) {
  const tag = home ? "H" : "A";
  return <span className="hidden sm:inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300" title={`${tag === "H" ? "Home" : "Away"} leg`}>{tag}</span>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-10 w-56" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-slate-800/80">
                <td className="px-3 py-3"><div className="skeleton h-6 w-6" /></td>
                <td className="px-3 py-3"><div className="skeleton h-7 w-40" /></td>
                {Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-2 py-3"><div className="skeleton mx-auto h-4 w-6" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
