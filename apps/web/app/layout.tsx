import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader, Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PostHogProvider } from "@/components/posthog-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-display" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Maven AI · Voice mock interviews",
  description:
    "Practice interviews with a real-time voice AI. Take clean turns, run a live coding round, and get a rubric-scored report.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn(inter.variable, mono.variable, serif.variable, "font-sans", geist.variable)}
      >
        <body className="font-sans">
          {/* Set the theme before first paint to avoid a flash. */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`,
            }}
          />
          <PostHogProvider>{children}</PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
