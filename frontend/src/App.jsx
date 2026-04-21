/**
 * App.jsx — Cloud Seeker with Cognito Auth Gate
 *
 * Flow:  IntroScreen (video + login form)  →  Dashboard
 *
 * HOW AUTH WORKS:
 *   1. Amplify is configured once here using your aws-exports.js
 *   2. IntroScreen renders the video background + login form
 *   3. When login succeeds, IntroScreen calls onComplete()
 *   4. App reveals the Dashboard (fade in)
 *   5. Dashboard stays visible — video continues looping in background until
 *      IntroScreen fully fades out (the dashboard is already mounted underneath)
 */

import { useState } from "react";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";          // ← your Cognito config
import "./styles/global.css";
import Dashboard from "./components/Dashboard";
import IntroScreen from "./components/IntroScreen";
import { NotificationProvider } from "./components/NotificationManager";

// ── One-time Amplify configuration ───────────────────────────────────────────
Amplify.configure(awsExports);

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // showIntro = true  → IntroScreen visible (video + login form)
  // showIntro = false → Dashboard visible (IntroScreen has faded out)
  const [showIntro, setShowIntro] = useState(true);

  return (
    <NotificationProvider>

      {/* ── IntroScreen (video + login gate) ── */}
      {showIntro && (
        <IntroScreen onComplete={() => setShowIntro(false)} />
      )}

      {/*
        ── Dashboard ──
        Always mounted (so data starts loading immediately), but:
        • invisible + non-interactive while intro is showing
        • fades in with a 0.3s delay after IntroScreen calls onComplete()
      */}
      <div
        style={{
          opacity: showIntro ? 0 : 1,
          transition: "opacity 0.5s ease 0.3s",
          pointerEvents: showIntro ? "none" : "auto",
        }}
      >
        <Dashboard />
      </div>

    </NotificationProvider>
  );
}
