/**
 * Cloud Seeker — IntroScreen v2 (CLEAN)
 * Video plays fullscreen → auto-fades to dashboard when ended.
 * NO timer, NO progress bar, NO skip button.
 */
import { useState, useRef, useEffect } from "react";

function CSLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="iBlue" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D47A1" />
          <stop offset="50%" stopColor="#0288D1" />
          <stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
        <linearGradient id="iArrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF6D00" />
          <stop offset="100%" stopColor="#FFD600" />
        </linearGradient>
      </defs>
      <path d="M8.5 26C5.5 26 3 23.6 3 20.5C3 17.8 5 15.6 7.6 15.1C7.5 14.8 7.5 14.4 7.5 14C7.5 11.0 10.0 8.5 13.0 8.5C13.9 8.5 14.8 8.7 15.6 9.2C16.8 6.9 19.2 5.3 22.0 5.3C26.4 5.3 30 8.9 30 13.3C30 13.5 30 13.7 29.9 13.9C31.7 14.6 33 16.4 33 18.5C33 21.5 30.6 24 27.5 24.2L27 26H8.5Z"
        stroke="url(#iBlue)" strokeWidth="1.4" fill="rgba(0,188,212,0.07)" />
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
      <line x1="9" y1="30" x2="26" y2="10" stroke="url(#iArrow)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 8.5L28 9L27.5 14" stroke="url(#iArrow)" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function IntroScreen({ onComplete }) {
  const videoRef = useRef(null);
  const [logoIn, setLogoIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const doneRef = useRef(false);

  // Logo entrance after 400 ms
  useEffect(() => {
    const t = setTimeout(() => setLogoIn(true), 400);
    return () => clearTimeout(t);
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setFadeOut(true);
    setTimeout(() => onComplete?.(), 900);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#000",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.9s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>
      {/* Video — fullscreen cover */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onEnded={finish}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
        }}
      >
        <source src="/furnace_remix.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay top + bottom */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.65) 100%)",
      }} />

      {/* Branding overlay — fades in */}
      <div style={{
        position: "absolute", top: "10%", left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 14, pointerEvents: "none",
        opacity: logoIn ? 1 : 0,
        transform: logoIn ? "translateY(0)" : "translateY(-18px)",
        transition: "opacity 0.9s ease, transform 0.9s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CSLogo size={58} />
          <div>
            <div style={{
              fontSize: 28, fontWeight: 700, letterSpacing: "0.12em",
              color: "#F1F5F9",
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              textShadow: "0 2px 20px rgba(0,0,0,0.7)",
            }}>CLOUD SEEKER</div>
            <div style={{
              fontSize: 12, letterSpacing: "0.22em", color: "#94A3B8",
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            }}>AWS SECURITY INTELLIGENCE PLATFORM</div>
          </div>
        </div>
        <div style={{
          fontSize: 13, color: "rgba(148,163,184,0.75)",
          fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
          letterSpacing: "0.06em",
          textShadow: "0 1px 8px rgba(0,0,0,0.9)",
        }}>
          Real-time threat detection across all AWS regions
        </div>
      </div>
    </div>
  );
}