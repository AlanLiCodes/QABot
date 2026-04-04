"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "New Run" },
  { href: "/chat", label: "💬 Chat" },
];

export default function NavBar() {
  const path = usePathname();
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-5xl px-4 h-12 flex items-center gap-6">
        <Link href="/" className="font-semibold text-white tracking-tight">
          QABot <span className="text-violet-400 font-normal text-xs ml-1">AI QA Engineer</span>
        </Link>
        <div className="flex gap-1 ml-4">
          {links.map(({ href, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-zinc-800 text-white font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-zinc-600 hidden sm:block">
          DiamondHacks 2026 · Browser Use + Gemini
        </div>
      </div>
    </nav>
  );
}
