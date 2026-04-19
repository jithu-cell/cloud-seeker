/**
 * Cloud Seeker — Intro Screen
 * Plays furnace_remix.mp4 fullscreen with logo overlay,
 * then fades out and hands control to the main dashboard.
 *
 * Usage in App.jsx:
 *   import IntroScreen from "./IntroScreen";
 *   <IntroScreen onComplete={() => setShowIntro(false)} />
 */
import { useState, useRef, useEffect } from "react";

// ── Cloud Seeker logo SVG (inline, no dependency) ────────────────────────────
function CSLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="iBlue" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0D47A1" />
          <stop offset="50%"  stopColor="#0288D1" />
          <stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
        <linearGradient id="iArrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#FF6D00" />
          <stop offset="100%" stopColor="#FFD600" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 26C5.5 26 3 23.6 3 20.5C3 17.8 5 15.6 7.6 15.1C7.5 14.8 7.5 14.4 7.5 14
           C7.5 11.0 10.0 8.5 13.0 8.5C13.9 8.5 14.8 8.7 15.6 9.2
           C16.8 6.9 19.2 5.3 22.0 5.3C26.4 5.3 30 8.9 30 13.3
           C30 13.5 30 13.7 29.9 13.9C31.7 14.6 33 16.4 33 18.5
           C33 21.5 30.6 24 27.5 24.2L27 26H8.5Z"
        stroke="url(#iBlue)" strokeWidth="1.4" fill="rgba(0,188,212,0.07)"
      />
      <circle cx="11" cy="19" r="1.8" fill="url(#iBlue)" />
      <circle cx="19" cy="13" r="1.8" fill="url(#iBlue)" />
      <circle cx="27" cy="16" r="1.8" fill="url(#iBlue)" />
      <circle cx="22" cy="22" r="1.8" fill="url(#iBlue)" />
      <line x1="11" y1="19" x2="19" y2="13" stroke="url(#iBlue)" strokeWidth="0.9" opacity="0.8" />
      <line x1="19" y1="13" x2="27" y2="16" stroke="url(#iBlue)" strokeWidth="0.9" opacity="0.8" />
      <line x1="27" y1="16" x2="22" y2="22" stroke="url(#iBlue)" strokeWidth="0.9" opacity="0.8" />
      <line x1="22" y1="22" x2="11" y2="19" stroke="url(#iBlue)" strokeWidth="0.9" opacity="0.8" />
      <line x1="11" y1="19" x2="27" y2="16" stroke="url(#iBlue)" strokeWidth="0.7" opacity="0.4" />
      <line x1="19" y1="13" x2="22" y2="22" stroke="url(#iBlue)" strokeWidth="0.7" opacity="0.4" />
      <line x1="9"  y1="30" x2="26" y2="10" stroke="url(#iArrow)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 8.5L28 9L27.5 14" stroke="url(#iArrow)" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IntroScreen({ onComplete }) {
  const videoRef  = useRef(null);
  const [phase, setPhase]         = useState("playing");   // "playing" | "fadeout"
  const [logoIn, setLogoIn]       = useState(false);
  const [skipHover, setSkipHover] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);
  const doneRef = useRef(false);

  // Trigger logo entrance after 400 ms
  useEffect(() => {
    const t = setTimeout(() => setLogoIn(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Fade-out then call onComplete
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("fadeout");
    setTimeout(() => onComplete?.(), 900);
  };

  // Update progress bar
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress((v.currentTime / v.duration) * 100);
  };

  const handleLoaded = () => {
    setDuration(videoRef.current?.duration || 0);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      opacity: phase === "fadeout" ? 0 : 1,
      transition: "opacity 0.85s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>

      {/* ── VIDEO (fullscreen cover) ──────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
        }}
      >
        {/* Put furnace_remix.mp4 in your /public folder */}
        <source src="/furnace_remix.mp4" type="video/mp4" />
      </video>

      {/* ── Dark gradient overlays (top + bottom) ────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 60%, rgba(0,0,0,0.75) 100%)",
      }} />

      {/* ── Branding (centre-top) ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "10%", left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 16, pointerEvents: "none",
        opacity: logoIn ? 1 : 0,
        transform: logoIn ? "translateY(0)" : "translateY(-20px)",
        transition: "opacity 0.9s ease, transform 0.9s ease",
      }}>
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CSLogo size={58} />
          <div>
            <div style={{
              fontSize: 28, fontWeight: 700, letterSpacing: "0.12em",
              color: "#F1F5F9",
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              textShadow: "0 2px 20px rgba(0,0,0,0.6)",
            }}>CLOUD SEEKER</div>
            <div style={{
              fontSize: 12, letterSpacing: "0.22em", color: "#94A3B8",
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              textShadow: "0 1px 8px rgba(0,0,0,0.8)",
            }}>AWS SECURITY INTELLIGENCE PLATFORM</div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 13, color: "rgba(148,163,184,0.8)",
          fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
          letterSpacing: "0.06em",
          textShadow: "0 1px 8px rgba(0,0,0,0.9)",
        }}>
          Real-time threat detection across all AWS regions
        </div>
      </div>

      {/* ── Bottom bar: progress + skip ──────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "0 32px 28px",
        opacity: logoIn ? 1 : 0,
        transition: "opacity 0.9s ease 0.3s",
      }}>
        {/* Progress bar */}
        <div style={{
          height: 2, background: "rgba(255,255,255,0.12)",
          borderRadius: 1, marginBottom: 16, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 1,
            background: "linear-gradient(90deg, #0288D1, #00BCD4)",
            width: `${progress}%`,
            transition: "width 0.3s linear",
          }} />
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Time */}
          <span style={{
            fontSize: 11, color: "rgba(148,163,184,0.6)",
            fontFamily: "'DM Mono', monospace",
          }}>
            {duration > 0
              ? `${Math.floor((progress / 100) * duration)}s / ${Math.floor(duration)}s`
              : "Loading…"}
          </span>

          {/* Skip button */}
          <button
            onClick={finish}
            onMouseEnter={() => setSkipHover(true)}
            onMouseLeave={() => setSkipHover(false)}
            style={{
              background: skipHover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              padding: "6px 16px",
              color: skipHover ? "#F1F5F9" : "rgba(148,163,184,0.8)",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
              letterSpacing: "0.06em",
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Enter Dashboard
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
