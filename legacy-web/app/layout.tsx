import type { Metadata, Viewport } from "next";
import { DM_Mono, Manrope, Newsreader } from "next/font/google";
import { GameProvider } from "@/lib/game-context";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
  adjustFontFallback: false,
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Vitality Tree — A Daily Practice for the Body",
  description:
    "A four-branch skill tree for mobility, endurance, strength and recovery. Small, structured practices that grow with you.",
  applicationName: "Vitality Tree",
};

export const viewport: Viewport = {
  themeColor: "#11140f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${manrope.variable} ${dmMono.variable}`}
    >
      <body className="font-sans antialiased">
        <GameProvider>{children}</GameProvider>
      </body>
    </html>
  );
}
