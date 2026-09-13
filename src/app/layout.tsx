import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paper Square — A little Times Square for the internet",
  description:
    "Explore an ink-on-paper Times Square. Discover independent brands and put yours on a virtual billboard.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
