import { ImageResponse } from "next/og";

// The link preview: what a shared Maven URL looks like in Slack, WhatsApp, X or
// an email. Generated at build time from the dark-theme tokens in globals.css
// (--ground / --fg / --accent / --teal) — no asset to keep in sync.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Maven — real-time voice mock interviews with a rubric-scored report";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(140deg, #131418 55%, #1B2440 100%)",
          color: "#ECEBE6",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#7C97FF",
              color: "#0B0C10",
              fontSize: 28,
              fontWeight: 700,
              borderRadius: 10,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 30, fontWeight: 600 }}>Maven</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 900,
            }}
          >
            Mock interviews that feel real.
          </div>
          <div style={{ fontSize: 30, color: "#9E9D98", maxWidth: 820 }}>
            Talk to a real-time voice interviewer, run a live coding round, and
            get a rubric-scored report with the full transcript.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#9E9D98",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#4AC8A0",
            }}
          />
          <div>Voice · Coding round · Scored feedback</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
