import type { Match, Player } from "@prisma/client";

export interface StandingsRow {
  playerId: string;
  name: string;
  avatar: string | null;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: ("W" | "D" | "L")[];
}

export interface CompletedMatchWithPlayers extends Match {
  homePlayer: Pick<Player, "id" | "name">;
  awayPlayer: Pick<Player, "id" | "name">;
}

const FORM_LIMIT = 5;

export function computeStandings(
  players: Pick<Player, "id" | "name" | "avatar">[],
  matches: CompletedMatchWithPlayers[],
  lastUpdated?: string
): { rows: StandingsRow[]; lastUpdated: string } {
  const map = new Map<string, StandingsRow>();

  for (const p of players) {
    map.set(p.id, {
      playerId: p.id,
      name: p.name,
      avatar: p.avatar ?? null,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      form: [],
    });
  }

  const sorted = [...matches]
    .filter((m) => m.status === "completed" && m.homeGoals != null && m.awayGoals != null)
    .sort((a, b) => {
      const ta = a.playedAt ? new Date(a.playedAt).getTime() : 0;
      const tb = b.playedAt ? new Date(b.playedAt).getTime() : 0;
      return ta - tb;
    });

  for (const m of sorted) {
    const home = map.get(m.homePlayerId);
    const away = map.get(m.awayPlayerId);
    if (!home || !away) continue;

    const hg = m.homeGoals as number;
    const ag = m.awayGoals as number;

    home.mp++;
    away.mp++;
    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    if (hg > ag) {
      home.w++;
      home.pts += 3;
      away.l++;
      home.form.push("W");
      away.form.push("L");
    } else if (hg < ag) {
      away.w++;
      away.pts += 3;
      home.l++;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.d++;
      away.d++;
      home.pts += 1;
      away.pts += 1;
      home.form.push("D");
      away.form.push("D");
    }

    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;
  }

  for (const row of map.values()) {
    row.form = row.form.slice(-FORM_LIMIT).reverse();
  }

  const rows = [...map.values()].sort((a, b) =>
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );

  return { rows, lastUpdated: lastUpdated ?? new Date().toISOString() };
}

export function fixturesTotal(n: number): number {
  return n <= 1 ? 0 : n * (n - 1);
}
