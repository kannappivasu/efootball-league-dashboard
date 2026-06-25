import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, roleArg] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/add-admin.ts <email> <password> [admin|super]");
    process.exit(1);
  }
  if (!email.includes("@") || email.length > 254) {
    throw new Error("Enter a valid email address");
  }
  if (password.length < 8 || password.length > 200) {
    throw new Error("Password must be between 8 and 200 characters");
  }
  const role = roleArg === "super" ? "super" : "admin";
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { passwordHash, role },
    create: { email: email.toLowerCase().trim(), passwordHash, role },
  });
  console.log(`✓ Admin ready: ${admin.email} (role: ${admin.role})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
