import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateFixturesForAll } from "../src/lib/fixtures";

const prisma = new PrismaClient();

const DEFAULT_PLAYERS = [
  "Sam",
  "Alex",
  "Jordan",
  "Casey",
  "Riley",
  "Morgan",
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@league.local";
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === "production" && !configuredPassword) {
    throw new Error("ADMIN_PASSWORD must be set when seeding in production");
  }
  const adminPassword = configuredPassword ?? "admin123";
  if (adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  // Ensure default admin exists (create or update password)
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash, role: "super" },
  });
  console.log(`✓ Admin ready: ${adminEmail} (password from ADMIN_PASSWORD env)`);

  // Add sample players only to an empty league. Existing leagues are never overwritten.
  let existing = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  if (existing.length === 0) {
    await prisma.player.createMany({
      data: DEFAULT_PLAYERS.map((name, order) => ({ name, order })),
    });
    existing = await prisma.player.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  const ids = existing.map((player) => player.id);
  console.log(`✓ ${ids.length} players: ${existing.map((player) => player.name).join(", ")}`);

  // Fill in only missing fixtures so existing scores and played dates remain intact.
  const fixtures = generateFixturesForAll(ids);
  const existingMatches = await prisma.match.findMany({
    select: { homePlayerId: true, awayPlayerId: true },
  });
  const existingPairs = new Set(
    existingMatches.map((match) => `${match.homePlayerId}:${match.awayPlayerId}`)
  );
  const missingFixtures = fixtures.filter(
    (fixture) => !existingPairs.has(`${fixture.homePlayerId}:${fixture.awayPlayerId}`)
  );
  if (missingFixtures.length) {
    await prisma.match.createMany({ data: missingFixtures });
  }
  console.log(`✓ Added ${missingFixtures.length} missing fixtures (${fixtures.length} total expected)`);

  await prisma.auditLog.create({
    data: {
      actor: "seed",
      action: "seed",
      detail: `Ensured ${ids.length} players and ${fixtures.length} fixtures; added ${missingFixtures.length}`,
    },
  });
  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); });
