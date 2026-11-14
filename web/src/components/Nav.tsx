"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/teams", "Teams"],
  ["/fourth-down", "4th downs"],
  ["/draft", "Draft"],
  ["/method", "Method"],
] as const;

export default function Nav() {
  const path = usePathname();
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="Football, measured: home">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="8" cy="13" r="5" fill="none" stroke="#c6ff3d" strokeWidth="2.2" />
            <path d="M15 8 l8 10 M23 8 l-8 10" stroke="#3dd6ff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          Football<span>, measured</span>
        </Link>
        <nav className="nav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
