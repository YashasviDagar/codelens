import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeLens",
  description: "AI-powered code review platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold text-slate-100">
            Code<span className="text-emerald-400">Lens</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href={"/"} className="hover:text-white">Overview</Link>
            <Link href={"/analytics"} className="hover:text-white">Analytics</Link>
            <a href="/api/auth/github" className="hover:text-white">Connect GitHub</a>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

