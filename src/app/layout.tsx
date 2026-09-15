import type { Metadata } from "next";
import { EntranceMusic } from "@/components/entrance-music";
import { Geist, Geist_Mono, Pinyon_Script, Bodoni_Moda, Google_Sans } from "next/font/google";
import "./globals.css";
import "./square-refresh.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});
const googleSans = Google_Sans({
  weight: "500",
  subsets: ["latin"],
  variable: "--font-google-sans",
  display: "swap",
  preload: false,
});
const welcomeScript = Pinyon_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-welcome-script",
  display: "swap",
});
const welcomeSerif = Bodoni_Moda({
  weight: "500",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-welcome-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Paper Square — A little Times Square for the internet",
  description:
    "Explore an ink-on-paper Times Square. Discover independent brands and put yours on a virtual billboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${welcomeScript.variable} ${welcomeSerif.variable} ${googleSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><EntranceMusic />{children}</body>
    </html>
  );
}
