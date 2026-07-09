// One organic voice orb, shared by the landing mock-interview card and the live
// interview room so both read identically: an asymmetric blob with a soft radial
// glow, breathing when idle, with a centered waveform that animates when there's
// a voice. `tone` is a CSS custom-prop name (e.g. "--accent"); `swell` lets the
// room scale the whole orb with real audio amplitude.

// Resting heights + stagger delays — varied so the idle shape reads as a voice
// wave and the active state moves like an equalizer.
const BARS = [
  { rest: 0.45, delay: 0 },
  { rest: 0.75, delay: 180 },
  { rest: 0.35, delay: 90 },
  { rest: 1, delay: 300 },
  { rest: 0.6, delay: 140 },
];

export function VoiceOrb({
  tone,
  active,
  size = 200,
  swell = 1,
}: {
  tone: string;
  active: boolean;
  size?: number;
  swell?: number;
}) {
  const barW = Math.max(3, Math.round(size * 0.035));
  const barH = Math.round(size * 0.26);
  const gap = Math.max(3, Math.round(size * 0.04));

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* organic halo — breathes while idle, morphs its shape while a voice is
          active; the room also drives `swell` from real audio amplitude */}
      <div
        className={`absolute inset-0 ${active ? "orb-morph-a" : "blob-breathe"}`}
        style={{
          borderRadius: "46% 54% 51% 49% / 54% 47% 53% 46%",
          background: `radial-gradient(circle at 50% 45%, rgb(var(${tone}) / 0.22), transparent 66%)`,
          border: `1px solid rgb(var(${tone}) / 0.16)`,
          transform: `scale(${swell})`,
          transition:
            "transform 90ms ease-out, background 400ms ease, border-color 400ms ease",
        }}
      />
      {/* inner blob gives the glow depth; morphs on a slower, reversed cycle so
          the two layers never line up — reads as random motion, not a loop */}
      <div
        className={`absolute ${active ? "orb-morph-b" : ""}`}
        style={{
          inset: "20%",
          borderRadius: "54% 46% 49% 51% / 47% 54% 46% 53%",
          background: `radial-gradient(circle at 50% 42%, rgb(var(${tone}) / 0.26), transparent 72%)`,
          transition: "background 400ms ease",
        }}
      />
      {/* centered waveform */}
      <div
        className="relative flex items-center"
        style={{ height: barH, gap: `${gap}px`, color: `rgb(var(${tone}))` }}
      >
        {BARS.map((b, i) => (
          <span
            key={i}
            className={`origin-center rounded-full bg-current ${active ? "orb-wave" : ""}`}
            style={{
              width: barW,
              height: "100%",
              transform: `scaleY(${b.rest})`,
              animationDelay: `${b.delay}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
