/**
 * App.jsx — Updated to show IntroScreen first, then Dashboard
 * Only change from your current App.jsx: wraps Dashboard with intro logic.
 */
import { useState } from "react";
import "./styles/global.css";
import Dashboard from "./components/Dashboard";
import IntroScreen from "./components/IntroScreen";
import { NotificationProvider } from "./components/NotificationManager";

export default function App() {
  // On first load: show intro. After intro finishes: show dashboard.
  const [showIntro, setShowIntro] = useState(true);

  return (
    <NotificationProvider>
      {/* Intro plays first, Dashboard is mounted underneath (hidden via intro overlay) */}
      {showIntro && (
        <IntroScreen onComplete={() => setShowIntro(false)} />
      )}

      {/* Dashboard always mounted — becomes visible when intro fades out */}
      <div style={{
        opacity: showIntro ? 0 : 1,
        transition: "opacity 0.5s ease 0.3s",
        pointerEvents: showIntro ? "none" : "auto",
      }}>
        <Dashboard />
      </div>
    </NotificationProvider>
  );
}
