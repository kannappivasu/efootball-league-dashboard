import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  adminId?: string;
  email?: string;
  role?: string;
  isLoggedIn: boolean;
}

const DEFAULT_SECRET =
  "dev-insecure-secret-please-change-in-production-xxxxxxxxxxxxxxxx";

function sessionOptions(): SessionOptions {
  const configuredSecret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }

  const password = configuredSecret || DEFAULT_SECRET;
  return {
    password: password.length >= 32 ? password : password.padEnd(32, "x"),
    cookieName: "efl_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions());
}

export async function requireAdmin(): Promise<SessionData> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.email) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
