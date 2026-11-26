import type { Metadata } from "next";
import { Oswald, Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { META } from "@/lib/data";
import { REPO } from "@/lib/site";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const display = Oswald({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600"] });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Football, measured · Satwik Medipalli",
  description: "Every NFL team by expected points, a transparent 4th-down model, and whether the combine tells you anything the draft slot doesn't.",
  metadataBase: new URL("https://football.satwikmedipalli.dev"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Nav />
        {children}
        <footer className="foot">
          <div className="wrap">
            <p>
              A personal project by Satwik Medipalli. Data from{" "}
              <a href="https://github.com/nflverse">nflverse</a>, rebuilt {META.built}.
            </p>
            <p>
              <a href="/method">Method & limits</a> · <a href={REPO}>Code ↗</a> ·{" "}
              <a href="https://baseball.satwikmedipalli.dev">Baseball ↗</a>
            </p>
            <p>
              <a href="https://satwikmedipalli.dev">Portfolio ↗</a> · <a href="https://github.com/satwikmedipalli">GitHub ↗</a> · <a href="https://linkedin.com/in/medipalli-satwik">LinkedIn ↗</a>
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
