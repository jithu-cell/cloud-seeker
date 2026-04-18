/**
 * Cloud Seeker — Dashboard.jsx (GOD MODE)
 *
 * HOW NOTIFICATIONS WORK (plain English):
 *   1. Every 15s we fetch /alerts from your real API
 *   2. We compare the new list to what we had before
 *   3. Any alert_id we haven't seen yet = NEW alert
 *   4. We call addNotification() ONCE per new alert
 *   5. NotificationManager queues them — shows ONE at a time
 *   6. No double popups ever
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNotifications } from "./NotificationManager";
import AlertFeed from "./AlertFeed";
import { ComplianceGauge } from "./ComplianceGauge";
import { ServiceHealth } from "./ComplianceGauge";
import MetricCard from "./MetricCard";
import RadarScanner from "./RadarScanner";
import WelcomeSection from "./WelcomeSection";

const API_BASE = process.env.REACT_APP_API_URL || "";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtTime(d) {
  return new Date(d).toLocaleTimeString("en-US", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── Architecture flow (right column) ────────────────────────────────────────
function ArchFlow() {
  const nodes = [
    { lbl: "CloudTrail", c: "#f59e0b" },
    { lbl: "S3 Storage",  c: "#3b82f6" },
    { lbl: "EventBridge", c: "#8b5cf6" },
    { lbl: "Step Fn",     c: "#06b6d4" },
    { lbl: "Lambda",      c: "#00d4aa" },
    { lbl: "DynamoDB",    c: "#f59e0b" },
    { lbl: "API Gateway", c: "#ec4899" },
  ];
  return (
    <div style={{ padding: "8px" }}>
      {nodes.map((n, i) => (
        <div key={n.lbl}>
          <div style={{
            display: "flex", alignItems: "center", gap: "7px",
            border: `1px solid ${n.c}44`, borderRadius: "4px",
            padding: "5px 9px", background: "rgba(10,22,32,.8)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: n.c, flexShrink: 0 }} />
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "11px", fontWeight: 700, color: "#e2f0ee" }}>
              {n.lbl}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <div style={{ paddingLeft: 13, margin: "1px 0" }}>
              <div style={{ width: 1, height: 7, background: n.c, opacity: .35 }} />
              <span style={{ fontSize: 6, color: "#6b9a9b", marginLeft: -2 }}>▼</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { addNotification } = useNotifications();        // ← from NotificationProvider

  const [activeTab,    setActiveTab]    = useState("overview");
  const [currentTime,  setCurrentTime]  = useState(new Date());
  const [stats,        setStats]        = useState(null);
  const [threatLevel,  setThreatLevel]  = useState("LOW");

  // Track which alert_ids we've already shown a notification for
  const seenAlertIds = useRef(new Set());
  // Store last fetched alerts for comparison
  const lastAlerts   = useRef([]);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch stats from real API ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!API_BASE) return;
    try {
      const r = await fetch(`${API_BASE}/stats`);
      const d = await r.json();
      setStats(d);
      // Update threat level based on critical alerts
      const crit = d.criticalAlerts || 0;
      const high = d.highAlerts || 0;
      if (crit > 0)      setThreatLevel("CRITICAL");
      else if (high > 0) setThreatLevel("HIGH");
      else               setThreatLevel("LOW");
    } catch (e) {
      console.warn("Stats fetch failed:", e.message);
    }
  }, []);

  // ── Poll alerts and fire notifications for NEW ones only ──────────────────
  const pollAlerts = useCallback(async () => {
    if (!API_BASE) return;
    try {
      const r = await fetch(`${API_BASE}/alerts?limit=50&status=OPEN`);
      const d = await r.json();
      const freshAlerts = (d.alerts || []);

      // Find alert_ids we haven't notified about yet
      const newOnes = freshAlerts.filter(a => !seenAlertIds.current.has(a.alert_id));

      // Add each new alert to the notification QUEUE — one at a time
      // (NotificationManager handles the queuing, so we just call addNotification)
      newOnes.forEach(a => {
        addNotification({
          severity: a.severity,
          title:    a.event_name,
          detail:   a.reason,
          region:   a.region,
          user:     a.user?.split("/").pop() || a.user,
        });
        seenAlertIds.current.add(a.alert_id);
      });

      lastAlerts.current = freshAlerts;
    } catch (e) {
      console.warn("Alert poll failed:", e.message);
    }
  }, [addNotification]);

  // Initial load + polling interval
  useEffect(() => {
    fetchStats();
    pollAlerts();
    const statsTimer  = setInterval(fetchStats,  60_000);   // stats every 60s
    const alertsTimer = setInterval(pollAlerts,  15_000);   // alerts every 15s
    return () => { clearInterval(statsTimer); clearInterval(alertsTimer); };
  }, [fetchStats, pollAlerts]);

  // ── Threat badge color ─────────────────────────────────────────────────────
  const threatColors = {
    CRITICAL: { bg: "rgba(239,68,68,.08)",  border: "rgba(239,68,68,.3)",  color: "#ef4444" },
    HIGH:     { bg: "rgba(249,115,22,.08)", border: "rgba(249,115,22,.3)", color: "#f97316" },
    MODERATE: { bg: "rgba(234,179,8,.08)",  border: "rgba(234,179,8,.3)",  color: "#eab308" },
    LOW:      { bg: "rgba(34,197,94,.08)",  border: "rgba(34,197,94,.3)",  color: "#22c55e" },
  };
  const tc = threatColors[threatLevel] || threatColors.LOW;

  const tabs = ["overview", "alerts", "compliance", "analytics"];

  return (
    <div className="dashboard-root">
      <div className="bg-grid" /><div className="bg-scanline" />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-left">
          <div className="logo-hex">
            <svg width="32" height="32" viewBox="0 0 36 36">
              <polygon points="18,2 32,10 32,26 18,34 4,26 4,10"
                fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
              <polygon points="18,8 27,13 27,23 18,28 9,23 9,13"
                fill="#00d4aa" opacity=".12" stroke="#00d4aa" strokeWidth=".5"/>
              <text x="18" y="22" textAnchor="middle" fill="#00d4aa"
                fontSize="9" fontWeight="700" fontFamily="monospace">CS</text>
            </svg>
          </div>
          <div>
            <div className="logo-title">CLOUD SEEKER</div>
            <div className="logo-sub">AWS Security Intelligence Platform</div>
          </div>
        </div>

        <nav className="nav-tabs">
          {tabs.map(t => (
            <button key={t}
              className={`nav-tab${activeTab === t ? " active" : ""}`}
              onClick={() => setActiveTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className="threat-pill" style={{
            background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color,
          }}>
            <span className="tdot" style={{ background: tc.color }} />
            THREAT: {threatLevel}
          </div>
          <div className="clock">
            <div className="clock-t">{fmtTime(currentTime.toISOString())}</div>
            <div className="clock-d">{currentTime.toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="main-content">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Metric cards */}
            <div className="metrics-row">
              <MetricCard label="TOTAL EVENTS"     value={(stats?.totalAlerts   ?? "—").toLocaleString()} delta={`+${stats?.lastHourAlerts ?? 0} last hour`}   color="teal"  icon="⬡" />
              <MetricCard label="CRITICAL ALERTS"  value={stats?.criticalAlerts ?? "—"}                    delta={`${stats?.openAlerts ?? 0} unresolved`}         color="red"   icon="⚠" />
              <MetricCard label="COMPLIANCE SCORE" value="91%"                                              delta="+3% this week"                                  color="green" icon="✦" />
              <MetricCard label="SERVICES ACTIVE"  value="13"                                               delta="All healthy"                                    color="blue"  icon="◈" />
            </div>

            {/* Main 3-col grid */}
            <div className="main-grid">
              {/* LEFT */}
              <div className="col">
                <div className="panel">
                  <div className="ph"><span className="pt">THREAT RADAR</span><span className="pb live">● LIVE</span></div>
                  <RadarScanner />
                </div>
                <div className="panel" style={{ flex: 1 }}>
                  <div className="ph"><span className="pt">SERVICE HEALTH</span></div>
                  <ServiceHealth />
                </div>
              </div>

              {/* CENTER — real alert feed */}
              <div className="col">
                <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div className="ph">
                    <span className="pt">REAL-TIME ALERT FEED</span>
                    <span className="pb live">● STREAMING</span>
                  </div>
                  <AlertFeed />
                </div>
              </div>

              {/* RIGHT */}
              <div className="col">
                <div className="panel">
                  <div className="ph"><span className="pt">COMPLIANCE</span><span className="pb">AWS CONFIG</span></div>
                  <ComplianceGauge />
                </div>
                <div className="panel" style={{ flex: 1 }}>
                  <div className="ph"><span className="pt">ARCHITECTURE FLOW</span></div>
                  <ArchFlow />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ALERTS TAB */}
        {activeTab === "alerts" && (
          <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
            {/* Same metric row */}
            <div className="metrics-row" style={{ marginBottom: 12 }}>
              <MetricCard label="TOTAL EVENTS"     value={(stats?.totalAlerts   ?? "—").toLocaleString()} delta={`+${stats?.lastHourAlerts ?? 0} last hour`}   color="teal"  icon="⬡" />
              <MetricCard label="CRITICAL ALERTS"  value={stats?.criticalAlerts ?? "—"}                    delta={`${stats?.openAlerts ?? 0} unresolved`}         color="red"   icon="⚠" />
              <MetricCard label="COMPLIANCE SCORE" value="91%"                                              delta="+3% this week"                                  color="green" icon="✦" />
              <MetricCard label="SERVICES ACTIVE"  value="13"                                               delta="All healthy"                                    color="blue"  icon="◈" />
            </div>
            <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div className="ph"><span className="pt">ALL ALERTS</span><span className="pb live">● LIVE</span></div>
              <AlertFeed />
            </div>
          </div>
        )}

        {/* COMPLIANCE TAB */}
        {activeTab === "compliance" && (
          <div className="panel" style={{ marginTop: 0 }}>
            <div className="ph"><span className="pt">COMPLIANCE STATUS</span><span className="pb">AWS CONFIG</span></div>
            <ComplianceGauge />
          </div>
        )}

        {/* ANALYTICS TAB — Welcome + insights */}
        {activeTab === "analytics" && <WelcomeSection apiBase={API_BASE} />}
      </main>
    </div>
  );
}
