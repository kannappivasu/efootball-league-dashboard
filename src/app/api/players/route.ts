import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { generateFixturesForPlayer } from "@/lib/fixtures";
import { validateAvatarUrl, validatePlayerName } from "@/lib/validation";

async function require() {
  const s = await getSession();
  if (!s.isLoggedIn || !s.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return s;
}

export async function GET() {
  const players = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  return NextResponse.json({ players });
}

export async function POST(req: Request) {
  const guard = await require();
  if (guard instanceof NextResponse) return guard;
  const session = guard;

  const body = await req.json().catch(() => ({})) as { name?: unknown; avatar?: unknown };
  const nameResult = validatePlayerName(body.name);
  if (nameResult.error) return NextResponse.json({ error: nameResult.error }, { status: 400 });
  const avatarResult = validateAvatarUrl(body.avatar);
  if (avatarResult.error) return NextResponse.json({ error: avatarResult.error }, { status: 400 });
  const name = nameResult.value!;
  const avatar = avatarResult.value ?? null;

  // auto-generate fixtures for this new player against existing players
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    if (existing.some((player) => player.name.localeCompare(name, undefined, { sensitivity: "accent" }) === 0)) {
      throw new Error("DUPLICATE_PLAYER");
    }
    const order = existing.length;
    const player = await tx.player.create({ data: { name, avatar, order } });
    const fixtures = generateFixturesForPlayer(player.id, existing);
    await tx.match.createMany({ data: fixtures });
    await tx.auditLog.create({
      data: {
        actor: session.email!,
        action: "player.create",
        detail: `Created player ${name} (+${fixtures.length} fixtures)`,
      },
    });
    return { player, fixturesCount: fixtures.length };
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "DUPLICATE_PLAYER") return null;
    throw error;
  });

  if (!created) return NextResponse.json({ error: "A player with that name already exists" }, { status: 409 });
  return NextResponse.json({ ok: true, player: created.player });
}
