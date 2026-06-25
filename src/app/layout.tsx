import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "eFootball League Dashboard",
  description: "Private friends eFootball round-robin league standings & fixtures",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-slate-950/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-pitch-400/30 bg-gradient-to-br from-pitch-500 to-pitch-800 text-xs font-black tracking-wider shadow-lg shadow-pitch-950/60">EL</span>
              <span className="text-base sm:text-lg">eFootball <span className="text-pitch-400">League</span></span>
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="rounded-xl px-3 py-2 text-slate-300 transition hover:bg-white/[0.06] hover:text-white">Standings</Link>
              <Link href="/admin" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-300 transition hover:border-pitch-500/30 hover:text-white">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 text-center text-xs text-slate-500">
          Built for the league · updated live
        </footer>
      </body>
    </html>
  );
}
