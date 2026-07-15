import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PostHogProvider } from "@/components/posthog-provider";

// "The Interview Desk": Fraunces is the editorial serif (headlines, wordmark,
// transcript quotes), Geist the body sans, JetBrains Mono the utility/label face.
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const description =
  "Practice interviews with a real-time voice AI. Take clean turns, run a live coding round, and get a rubric-scored report.";

export const metadata: Metadata = {
  // Absolute URLs for the OG card. Vercel sets VERCEL_URL per deployment; set
  // NEXT_PUBLIC_SITE_URL to pin the canonical domain in production.
  // `||`, not `??`: a declared-but-blank NEXT_PUBLIC_SITE_URL (exactly what copying
  // .env.example gives you) is an empty string, which ?? happily passes through to
  // new URL("") — and that throws, failing the whole build.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  ),
  title: "Maven",
  description,
  openGraph: {
    title: "Maven — mock interviews that feel real",
    description,
    siteName: "Maven",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Maven", description },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        suppressHydrationWarning
        className={cn(display.variable, sans.variable, mono.variable, "font-sans")}
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
