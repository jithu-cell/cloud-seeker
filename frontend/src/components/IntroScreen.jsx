/**
 * Cloud Seeker — IntroScreen v3 (LOGIN GATE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Video plays fullscreen + loops.
 * Login form floats on top — admin must authenticate before entering dashboard.
 * Uses AWS Amplify (Cognito) for auth.
 *
 * Props:
 *   onComplete() — called after successful login (triggers dashboard reveal)
 */

import { useState, useRef, useEffect } from "react";
import { signIn, signUp, confirmSignUp, resetPassword } from "aws-amplify/auth";

// ── Logo (unchanged from v2) ──────────────────────────────────────────────────
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
      <path
        d="M8.5 26C5.5 26 3 23.6 3 20.5C3 17.8 5 15.6 7.6 15.1C7.5 14.8 7.5 14.4 7.5 14C7.5 11.0 10.0 8.5 13.0 8.5C13.9 8.5 14.8 8.7 15.6 9.2C16.8 6.9 19.2 5.3 22.0 5.3C26.4 5.3 30 8.9 30 13.3C30 13.5 30 13.7 29.9 13.9C31.7 14.6 33 16.4 33 18.5C33 21.5 30.6 24 27.5 24.2L27 26H8.5Z"
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
      <line x1="9" y1="30" x2="26" y2="10" stroke="url(#iArrow)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 8.5L28 9L27.5 14" stroke="url(#iArrow)" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Lock icon SVG ─────────────────────────────────────────────────────────────
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    </svg>
  );
}

// ── User icon SVG ─────────────────────────────────────────────────────────────
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.106 7.222c0-2.967-2.249-5.032-5.482-5.032-3.35 0-5.646 2.318-5.646 5.702 0 3.493 2.235 5.708 5.762 5.708.862 0 1.689-.123 2.304-.335v-.862c-.43.199-1.354.328-2.29.328-2.926 0-4.813-1.88-4.813-4.798 0-2.844 1.921-4.881 4.594-4.881 2.735 0 4.608 1.688 4.608 4.156 0 1.682-.554 2.769-1.416 2.769-.492 0-.772-.28-.772-.76V5.206H8.923v.834h-.11c-.266-.595-.881-.964-1.6-.964-1.4 0-2.378 1.162-2.378 2.823 0 1.737.957 2.906 2.379 2.906.8 0 1.415-.39 1.709-1.087h.11c.081.67.703 1.148 1.503 1.148 1.572 0 2.57-1.415 2.57-3.643zm-7.177.704c0-1.197.54-1.907 1.456-1.907.93 0 1.524.738 1.524 1.907S8.308 9.84 7.371 9.84c-.895 0-1.442-.725-1.442-1.914z" />
    </svg>
  );
}

// ── Email icon SVG ────────────────────────────────────────────────────────────
function EmailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.758 2.855L15 11.114V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.114l4.758-2.876L1 5.383v5.731z" />
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// VIEW MODES:  "login" | "signup" | "confirm" | "forgot" | "success"
// ═════════════════════════════════════════════════════════════════════════════
export default function IntroScreen({ onComplete }) {
  const videoRef = useRef(null);
  const [logoIn, setLogoIn] = useState(false);
  const [formIn, setFormIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // ── Auth form state ──────────────────────────────────────────────────────
  const [view, setView] = useState("login"); // login | signup | confirm | forgot
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");      // confirm password (signup)
  const [code, setCode] = useState("");       // verification code
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Entrance animations ──────────────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setLogoIn(true), 400);
    const t2 = setTimeout(() => setFormIn(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // ── After login success: fade intro out, reveal dashboard ────────────────
  const finish = () => {
    setFadeOut(true);
    setTimeout(() => onComplete?.(), 900);
  };

  // ── Helper: clear messages when switching views ──────────────────────────
  const switchView = (v) => {
    setView(v);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirm("");
    setCode("");
  };

  // ════════════════════════════════════════════════════════════════════════
  // AUTH HANDLERS
  // ════════════════════════════════════════════════════════════════════════

  // ── LOGIN ────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn({ username: username.trim(), password });
      // ✅ Login successful → fade out and show dashboard
      setSuccess("Access granted. Entering Cloud Seeker…");
      setTimeout(finish, 1200);
    } catch (err) {
      console.error("Login error:", err);
      if (err.name === "UserNotConfirmedException") {
        setError("Account not confirmed. Check your email for the verification code.");
        setTimeout(() => switchView("confirm"), 1500);
      } else if (err.name === "NotAuthorizedException") {
        setError("Incorrect username or password.");
      } else if (err.name === "UserNotFoundException") {
        setError("User not found. Please sign up first.");
      } else {
        setError(err.message || "Login failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── SIGN UP ──────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp({
        username: username.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
          },
        },
      });
      setSuccess("Account created! Check your email for the 6-digit verification code.");
      setTimeout(() => switchView("confirm"), 1500);
    } catch (err) {
      console.error("SignUp error:", err);
      if (err.name === "UsernameExistsException") {
        setError("Username already exists. Try logging in.");
      } else {
        setError(err.message || "Sign up failed. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── CONFIRM SIGN UP (verify email code) ──────────────────────────────────
  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!username.trim() || !code.trim()) {
      setError("Enter your username and verification code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await confirmSignUp({ username: username.trim(), confirmationCode: code.trim() });
      setSuccess("Email verified! You can now log in.");
      setTimeout(() => switchView("login"), 1500);
    } catch (err) {
      console.error("Confirm error:", err);
      setError(err.message || "Invalid code. Check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Enter your username.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword({ username: username.trim() });
      setSuccess("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // SHARED INPUT STYLE
  // ════════════════════════════════════════════════════════════════════════
  const inputField = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "rgba(255,255,255,0.6)",
    transition: "border-color 0.2s",
  };

  const inputStyle = {
    background: "none",
    border: "none",
    outline: "none",
    width: "100%",
    color: "#D1D5DB",
    fontSize: "13px",
    fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "#000",
      opacity: fadeOut ? 0 : 1,
      transition: "opacity 0.9s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>

      {/* ── Video — fullscreen cover, loops ── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop          // ← loops forever until login succeeds
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      >
        <source src="/furnace_remix.mp4" type="video/mp4" />
      </video>

      {/* ── Gradient overlay ── */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.6) 100%)",
      }} />

      {/* ── Top branding ── */}
      <div style={{
        position: "absolute",
        top: "6%",
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        pointerEvents: "none",
        opacity: logoIn ? 1 : 0,
        transform: logoIn ? "translateY(0)" : "translateY(-18px)",
        transition: "opacity 0.9s ease, transform 0.9s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CSLogo size={48} />
          <div>
            <div style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#F1F5F9",
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              textShadow: "0 2px 20px rgba(0,0,0,0.7)",
            }}>CLOUD SEEKER</div>
            <div style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              color: "#94A3B8",
              fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            }}>AWS SECURITY INTELLIGENCE PLATFORM</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          LOGIN FORM — centered on screen, over the video
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: formIn ? "auto" : "none",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 360,
          margin: "0 16px",
          opacity: formIn ? 1 : 0,
          transform: formIn ? "translateY(0) scale(1)" : "translateY(30px) scale(0.96)",
          transition: "opacity 0.8s ease, transform 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* Glass card */}
          <div style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: "20px",
            padding: "32px 28px 28px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
          }}>

            {/* Card header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#F1F5F9",
                letterSpacing: "0.06em",
                fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              }}>
                {view === "login" && "Admin Access"}
                {view === "signup" && "Create Account"}
                {view === "confirm" && "Verify Email"}
                {view === "forgot" && "Reset Password"}
              </div>
              <div style={{
                fontSize: 11,
                color: "#64748B",
                marginTop: 4,
                letterSpacing: "0.08em",
                fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
              }}>
                {view === "login" && "Authenticate to enter the dashboard"}
                {view === "signup" && "Register a new admin account"}
                {view === "confirm" && "Enter the 6-digit code from your email"}
                {view === "forgot" && "Enter your username to reset password"}
              </div>
            </div>

            {/* ── LOGIN FORM ── */}
            {view === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><UserIcon /></span>
                  <input
                    style={inputStyle}
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><LockIcon /></span>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                {/* Error / success */}
                <MessageBox error={error} success={success} />

                <button
                  type="submit"
                  disabled={loading}
                  style={primaryBtn(loading)}
                >
                  {loading ? <Spinner /> : "Login"}
                </button>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button type="button" onClick={() => switchView("signup")} style={ghostBtn}>Sign Up</button>
                  <button type="button" onClick={() => switchView("forgot")} style={ghostBtn}>Forgot Password</button>
                </div>

              </form>
            )}

            {/* ── SIGN UP FORM ── */}
            {view === "signup" && (
              <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><UserIcon /></span>
                  <input style={inputStyle} type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><EmailIcon /></span>
                  <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><LockIcon /></span>
                  <input style={inputStyle} type="password" placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><LockIcon /></span>
                  <input style={inputStyle} type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>

                <MessageBox error={error} success={success} />

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading ? <Spinner /> : "Create Account"}
                </button>
                <button type="button" onClick={() => switchView("login")} style={ghostBtn}>← Back to Login</button>

              </form>
            )}

            {/* ── CONFIRM / VERIFY FORM ── */}
            {view === "confirm" && (
              <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><UserIcon /></span>
                  <input style={inputStyle} type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                    </svg>
                  </span>
                  <input style={inputStyle} type="text" placeholder="6-digit verification code" value={code} onChange={e => setCode(e.target.value)} maxLength={6} required />
                </div>

                <MessageBox error={error} success={success} />

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading ? <Spinner /> : "Verify Account"}
                </button>
                <button type="button" onClick={() => switchView("login")} style={ghostBtn}>← Back to Login</button>

              </form>
            )}

            {/* ── FORGOT PASSWORD FORM ── */}
            {view === "forgot" && (
              <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                <div style={inputField}>
                  <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><UserIcon /></span>
                  <input style={inputStyle} type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>

                <MessageBox error={error} success={success} />

                <button type="submit" disabled={loading} style={primaryBtn(loading)}>
                  {loading ? <Spinner /> : "Send Reset Email"}
                </button>
                <button type="button" onClick={() => switchView("login")} style={ghostBtn}>← Back to Login</button>

              </form>
            )}

          </div>

          {/* Subtle bottom label */}
          <div style={{
            textAlign: "center",
            marginTop: 12,
            fontSize: 10,
            color: "rgba(100,116,139,0.6)",
            letterSpacing: "0.08em",
            fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
          }}>
            SECURED BY AWS COGNITO
          </div>

        </div>
      </div>

    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

function MessageBox({ error, success }) {
  if (!error && !success) return null;
  return (
    <div style={{
      padding: "9px 12px",
      borderRadius: "8px",
      fontSize: "12px",
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
      background: error ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
      border: error ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(34,197,94,0.3)",
      color: error ? "#FCA5A5" : "#86EFAC",
      lineHeight: 1.5,
    }}>
      {error || success}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block",
      width: 14,
      height: 14,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "cs-spin 0.7s linear infinite",
    }} />
  );
}

// Shared button styles
const primaryBtn = (loading) => ({
  padding: "11px",
  borderRadius: "10px",
  border: "none",
  outline: "none",
  cursor: loading ? "default" : "pointer",
  background: loading
    ? "rgba(99,102,241,0.4)"
    : "linear-gradient(135deg, #4F46E5 0%, #0288D1 100%)",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 600,
  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
  letterSpacing: "0.04em",
  transition: "opacity 0.2s, transform 0.15s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  marginTop: 4,
});

const ghostBtn = {
  flex: 1,
  padding: "9px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.08)",
  outline: "none",
  cursor: "pointer",
  background: "rgba(255,255,255,0.04)",
  color: "#94A3B8",
  fontSize: "11px",
  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
  letterSpacing: "0.04em",
  transition: "background 0.2s",
};
