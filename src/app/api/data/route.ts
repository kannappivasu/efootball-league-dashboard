import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  const matches = await prisma.match.findMany({
    include: {
      homePlayer: { select: { id: true, name: true, avatar: true } },
      awayPlayer: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { playedAt: "asc" },
  });

  const completed = matches.filter((m) => m.status === "completed");
  const latestResultAt = completed.reduce(
    (latest, match) => Math.max(latest, match.playedAt?.getTime() ?? 0),
    0
  );
  const leagueUpdatedAt = latestResultAt ? new Date(latestResultAt).toISOString() : null;
  const { rows } = computeStandings(players, completed, leagueUpdatedAt ?? undefined);

  return NextResponse.json({
    players,
    matches,
    standings: rows,
    lastUpdated: leagueUpdatedAt,
    generatedAt: new Date().toISOString(),
    count: { players: players.length, matches: matches.length },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
