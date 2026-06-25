import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}) as { email?: string; password?: string });
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  if (email.length > 254 || password.length > 200) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await getSession();
  session.adminId = admin.id;
  session.email = admin.email;
  session.role = admin.role;
  session.isLoggedIn = true;
  await session.save();

  // Authentication must not fail if optional audit storage is temporarily
  // unavailable (for example, a read-only bundled SQLite database).
  try {
    await prisma.auditLog.create({ data: { actor: admin.email, action: "login", detail: "Admin logged in" } });
  } catch (error) {
    console.error("Failed to write login audit log", error);
  }
  return NextResponse.json(
    { ok: true, email: admin.email, role: admin.role },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE() {
  const session = await getSession();
  const email = session.email;
  session.destroy();
  if (email) {
    try { await prisma.auditLog.create({ data: { actor: email, action: "logout" } }); } catch {}
  }
  return NextResponse.json({ ok: true });
}
