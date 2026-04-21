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
import awsExports from "./aws-exports";
import "./styles/global.css";
import Dashboard from "./components/Dashboard";
import IntroScreen from "./components/IntroScreen";
import { NotificationProvider } from "./components/NotificationManager";

Amplify.configure(awsExports);

export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <>
      {/* Login gate — always shown first */}
      {showIntro && (
        <IntroScreen onComplete={() => setShowIntro(false)} />
      )}

      {/* Dashboard + notifications — only mounts AFTER login */}
      {!showIntro && (
        <NotificationProvider>
          <Dashboard />
        </NotificationProvider>
      )}
    </>
  );
}