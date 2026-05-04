import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RunCoach AI",
  description: "AI-powered marathon coaching and training planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/plans/base-building", label: "Base Plan" },
    { href: "/plans/marathon", label: "Marathon Plan" },
    { href: "/strength", label: "Strength" },
    { href: "/coach", label: "AI Coach" },
  ];

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6">
          <header className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                RunCoach AI
              </Link>
              <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-2 py-1 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="flex-1 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
