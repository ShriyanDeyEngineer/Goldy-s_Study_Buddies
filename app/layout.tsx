/**
 * Root layout — wraps every single page in the app (marketing, auth, and
 * the signed-in app alike).
 *
 * Responsibilities:
 *   1. Load our two fonts (Inter for body/UI, DM Serif Display for
 *      headings) and expose them as CSS variables that globals.css maps
 *      into Tailwind's font-sans / font-display.
 *   2. Set the default <title> / description used for SEO on public pages.
 *   3. Mount the toast portal (sonner) once, so any page can fire a toast.
 *
 * Touch this file to change fonts, default metadata, or anything that must
 * exist on literally every page. Page chrome (headers, footers, nav) does
 * NOT belong here — that lives in the route-group layouts.
 */
import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

/* Two weights only (400/600) per the design spec — keeps page weight down. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

/* Display face ships in a single 400 weight; that is all headings use. */
const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-dm-serif",
});

export const metadata: Metadata = {
  title: {
    default: "Goldy's Study Buddies — Find study partners at the U",
    template: "%s · Goldy's Study Buddies",
  },
  description:
    "Never study alone at the U again. Find study partners and join study groups for your University of Minnesota courses.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSerif.variable}`}>
      <body>
        {children}
        {/* One global toast portal. richColors keeps success green /
            error red consistent with our semantic tokens. */}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
