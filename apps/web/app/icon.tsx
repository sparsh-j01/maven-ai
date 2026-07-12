import { ImageResponse } from "next/og";

// Maven favicon: the wordmark's initial on the brand cobalt (--accent /
// --on-accent). Replaces the stale create-next-app default with something
// on-brand; a single glyph so it still reads at 16px.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1F49DE",
          color: "#FFFFFF",
          fontSize: 23,
          fontWeight: 700,
          borderRadius: 7,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
