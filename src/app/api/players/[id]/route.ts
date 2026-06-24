import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { validateAvatarUrl, validatePlayerName } from "@/lib/validation";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { name?: unknown; avatar?: unknown };
  const data: { name?: string; avatar?: string | null } = {};

  if (body.name !== undefined) {
    const result = validatePlayerName(body.name);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    data.name = result.value;
  }
  if (body.avatar !== undefined) {
    const result = validateAvatarUrl(body.avatar);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    data.avatar = result.value ?? null;
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "No valid changes supplied" }, { status: 400 });
  }

  const existingPlayers = await prisma.player.findMany({ select: { id: true, name: true } });
  if (data.name && existingPlayers.some((player) =>
    player.id !== id && player.name.localeCompare(data.name!, undefined, { sensitivity: "accent" }) === 0
  )) {
    return NextResponse.json({ error: "A player with that name already exists" }, { status: 409 });
  }

  const existing = existingPlayers.find((player) => player.id === id);
  if (!existing) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const player = await tx.player.update({ where: { id }, data });
    await tx.auditLog.create({
      data: { actor: guard.email!, action: "player.update", detail: `Updated ${existing.name} to ${player.name}` },
    });
    return player;
  });
  return NextResponse.json({ ok: true, player: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;
  const existing = await prisma.player.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.player.delete({ where: { id } });
    await tx.auditLog.create({
      data: { actor: guard.email!, action: "player.delete", detail: `Deleted ${existing.name} (+cascaded fixtures)` },
    });
  });
  return NextResponse.json({ ok: true });
}
