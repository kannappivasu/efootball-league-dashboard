import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

function validScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** Recompute & mark a match as completed with entered scores. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as {
    homeGoals?: number;
    awayGoals?: number;
    status?: string;
    delete?: boolean;
  };

  const existing = await prisma.match.findUnique({ where: { id }, include: { homePlayer: { select: { name: true } }, awayPlayer: { select: { name: true } } } });
  if (!existing) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  if (body.delete === true) {
    // reset to scheduled, no scores
    const m = await prisma.$transaction(async (tx) => {
      const match = await tx.match.update({
        where: { id },
        data: { homeGoals: null, awayGoals: null, status: "scheduled", playedAt: null },
      });
      await tx.auditLog.create({
        data: {
          actor: guard.email!,
          action: "match.reset",
          detail: `Reset ${existing.homePlayer.name} vs ${existing.awayPlayer.name}`,
        },
      });
      return match;
    });
    return NextResponse.json({ ok: true, match: m });
  }

  const homeGoals = body.homeGoals;
  const awayGoals = body.awayGoals;
  if (!validScore(homeGoals) || !validScore(awayGoals)) {
    return NextResponse.json({ error: "Both scores must be non-negative integers" }, { status: 400 });
  }

  const m = await prisma.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: { id },
      data: {
        homeGoals,
        awayGoals,
        status: "completed",
        playedAt: existing.playedAt ?? new Date(),
      },
    });
    await tx.auditLog.create({
      data: {
        actor: guard.email!,
        action: existing.status === "completed" ? "match.update" : "match.complete",
        detail: `${existing.homePlayer.name} ${homeGoals}:${awayGoals} ${existing.awayPlayer.name}`,
      },
    });
    return match;
  });
  return NextResponse.json({ ok: true, match: m });
}
