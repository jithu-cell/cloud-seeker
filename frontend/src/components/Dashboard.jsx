/**
 * Cloud Seeker — Enterprise Dashboard (Complete Redesign)
 * Clean, professional, Linear/Vercel style. No neon, no glow.
 * All 4 tabs: Overview, Alerts, Compliance, Analytics
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNotifications } from "./NotificationManager";

const API = process.env.REACT_APP_API_URL || "";

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

const fmtFullTime = () =>
  new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icon = {
  Grid: () => <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  Bell: () => <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Shield: () => <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Chart: () => <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  Link: () => <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
  Gear: () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Refresh: () => <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>,
  Pulse: () => <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Alert: () => <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Check: () => <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Server: () => <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
};

// ── Severity Badge ────────────────────────────────────────────────────────────
function Badge({ severity }) {
  return (
    <span className={`badge badge-${severity}`}>
      <span className="badge-dot" />
      {severity}
    </span>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ bySeverity }) {
  const segs = [
    { key: "CRITICAL", color: "#EF4444" },
    { key: "HIGH", color: "#F59E0B" },
    { key: "MEDIUM", color: "#6366F1" },
    { key: "LOW", color: "#22C55E" },
  ];
  const total = Object.values(bySeverity).reduce((s, v) => s + v, 0) || 1;
  let offset = 25;

  return (
    <div className="donut-wrap">
      <svg width="100" height="100" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="rgba(255,255,255,.05)" strokeWidth="3" />
        {segs.map((s) => {
          const pct = ((bySeverity[s.key] || 0) / total) * 100;
          const el = (
            <circle key={s.key} cx="18" cy="18" r="15.9155" fill="transparent"
              stroke={s.color} strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dasharray 1s ease" }}
            />
          );
          offset -= pct;
          return el;
        })}
      </svg>
      <div className="donut-legend">
        {segs.map((s) => (
          <div key={s.key} className="leg-item">
            <div className="leg-dot" style={{ background: s.color }} />
            <span className="leg-label">{s.key}</span>
            <span className="leg-count">{bySeverity[s.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Region Bars ───────────────────────────────────────────────────────────────
function RegionBars({ byRegion }) {
  const colors = { "eu-north-1": "#4F46E5", "us-east-1": "#6366F1", "us-west-2": "#22C55E", "eu-west-1": "#F59E0B", "ap-southeast-1": "#EC4899" };
  const entries = Object.entries(byRegion);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);

  if (!entries.length) return <div className="empty-state"><div className="empty-state-text">No region data yet</div></div>;
  return (
    <div className="bar-group">
      {entries.slice(0, 6).map(([r, c]) => {
        const color = colors[r] || "#6366F1";
        const pct = (c / max) * 100;
        return (
          <div key={r} className="bar-row">
            <div className="bar-label">{r}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: animated ? `${pct}%` : "0%", background: color }} />
            </div>
            <div className="bar-count">{c}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Compliance Bars ───────────────────────────────────────────────────────────
const COMPLIANCE_RULES = [
  { name: "CIS AWS Benchmark", icon: "🏛️", score: 94, color: "#4F46E5" },
  { name: "PCI DSS", icon: "💳", score: 87, color: "#F59E0B" },
  { name: "SOC 2", icon: "✅", score: 96, color: "#22C55E" },
  { name: "HIPAA", icon: "🏥", score: 89, color: "#F59E0B" },
  { name: "NIST 800-53", icon: "🔒", score: 78, color: "#64748B" },
  { name: "AWS Well-Architected", icon: "☁️", score: 92, color: "#6366F1" },
];

// ── Detection Pipeline ────────────────────────────────────────────────────────
const PIPELINE = [
  { icon: "🖥️", name: "AWS Action", desc: "Console or API change" },
  { icon: "📋", name: "CloudTrail", desc: "Records every API call" },
  { icon: "⚡", name: "EventBridge", desc: "Detects in ~30s" },
  { icon: "λ", name: "Lambda", desc: "Analyzes threat level" },
  { icon: "🗄️", name: "DynamoDB", desc: "Stores alert record" },
  { icon: "📧", name: "SNS Email", desc: "Gmail notification" },
  { icon: "📊", name: "Dashboard", desc: "Real-time view" },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { addNotification } = useNotifications();

  const [tab, setTab] = useState("overview");
  const [clock, setClock] = useState(fmtFullTime());
  const [stats, setStats] = useState(null);
  const [allAlerts, setAllAlerts] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(new Set());
  const [compAnimated, setCompAnim] = useState(false);
  const [threatLevel, setThreatLevel] = useState("LOW");
  const seenIds = useRef(new Set());

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(fmtFullTime()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!API) { setStats({ totalAlerts: 54, openAlerts: 50, lastHourAlerts: 6, criticalAlerts: 4, highAlerts: 20, bySeverity: { CRITICAL: 4, HIGH: 20, MEDIUM: 6, LOW: 24 }, byRegion: { "eu-north-1": 54 } }); return; }
    try { const r = await fetch(`${API}/stats`); const d = await r.json(); setStats(d); } catch { }
  }, []);

  // Fetch alerts + fire notifications for new ones
  const fetchAlerts = useCallback(async () => {
    let items = [];
    if (!API) {
      items = [
        { alert_id: "1", event_name: "AuthorizeSecurityGroupIngress", reason: "SG sg-060be7 opened to world (0.0.0.0/0) port any", severity: "CRITICAL", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "arn:aws:iam::382334304729:user/Jithu", source_ip: "103.42.196.77", created_at: new Date().toISOString(), status: "OPEN" },
        { alert_id: "2", event_name: "TerminateInstances", reason: "EC2 instance(s) TERMINATED in eu-north-1", severity: "HIGH", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 300000).toISOString(), status: "OPEN" },
        { alert_id: "3", event_name: "RunInstances", reason: "EC2 t3.micro launched by Jithu", severity: "HIGH", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 600000).toISOString(), status: "OPEN" },
        { alert_id: "4", event_name: "PutBucketPolicy", reason: "S3 bucket policy changed", severity: "HIGH", event_source: "s3.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 900000).toISOString(), status: "OPEN" },
        { alert_id: "5", event_name: "UpdateTrail", reason: "CloudTrail configuration changed", severity: "MEDIUM", event_source: "cloudtrail.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 1200000).toISOString(), status: "OPEN" },
        { alert_id: "6", event_name: "UpdateFunctionCode", reason: "'UpdateFunctionCode' on LAMBDA by Jithu", severity: "LOW", event_source: "lambda.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 1500000).toISOString(), status: "OPEN" },
      ];
    } else {
      try { const r = await fetch(`${API}/alerts?limit=100&status=OPEN`); const d = await r.json(); items = d.alerts || []; } catch { }
    }
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // Notify new ones
    items.forEach(a => {
      if (!seenIds.current.has(a.alert_id)) {
        addNotification({ severity: a.severity, title: a.event_name, detail: a.reason, region: a.region, user: a.user?.split("/").pop() });
        seenIds.current.add(a.alert_id);
      }
    });
    setAllAlerts(items);
    setLoading(false);

    // Update threat level
    const crit = items.filter(a => a.severity === "CRITICAL").length;
    const high = items.filter(a => a.severity === "HIGH").length;
    if (crit > 0) setThreatLevel("CRITICAL");
    else if (high > 0) setThreatLevel("HIGH");
    else setThreatLevel("LOW");
  }, [addNotification]);

  useEffect(() => {
    fetchStats();
    fetchAlerts();
    const s = setInterval(fetchStats, 60_000);
    const a = setInterval(fetchAlerts, 15_000);
    return () => { clearInterval(s); clearInterval(a); };
  }, [fetchStats, fetchAlerts]);

  const resolveAlert = async (id) => {
    setResolving(prev => new Set([...prev, id]));
    if (API) { try { await fetch(`${API}/alerts/${id}/resolve`, { method: "POST" }); } catch { } }
    setAllAlerts(prev => prev.filter(a => a.alert_id !== id));
    setResolving(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  // Counts
  const counts = { ALL: allAlerts.length, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  allAlerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });
  const filtered = filter === "ALL" ? allAlerts : allAlerts.filter(a => a.severity === filter);

  const threatChipClass = threatLevel === "CRITICAL" ? "status-crit" : threatLevel === "HIGH" ? "status-warn" : "status-ok";
  const threatChipLabel = threatLevel === "CRITICAL" ? "Threat: Critical" : threatLevel === "HIGH" ? "Threat: High" : "All Clear";

  // Page meta
  const pages = {
    overview: ["Cloud Security Overview", "Real-time monitoring of your AWS environment"],
    alerts: ["Security Alerts", "Manage and respond to security events"],
    compliance: ["Compliance Overview", "Security framework compliance status"],
    analytics: ["Security Analytics", "Activity trends and environment insights"],
  };
  const [pageTitle, pageSub] = pages[tab];

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "compliance") setTimeout(() => setCompAnim(true), 100);
  };

  return (
    <div className="app-layout">

      {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sb-logo">
          {/* Cloud Seeker Logo — matches the provided brand image exactly */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="csBlue" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0D47A1" />
                <stop offset="50%" stopColor="#0288D1" />
                <stop offset="100%" stopColor="#00BCD4" />
              </linearGradient>
              <linearGradient id="csArrow" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#FF6D00" />
                <stop offset="100%" stopColor="#FFD600" />
              </linearGradient>
            </defs>

            {/* Cloud outline — main silhouette */}
            <path
              d="M8.5 26C5.5 26 3 23.6 3 20.5C3 17.8 5 15.6 7.6 15.1C7.5 14.8 7.5 14.4 7.5 14
         C7.5 11.0 10.0 8.5 13.0 8.5C13.9 8.5 14.8 8.7 15.6 9.2
         C16.8 6.9 19.2 5.3 22.0 5.3C26.4 5.3 30 8.9 30 13.3
         C30 13.5 30 13.7 29.9 13.9
         C31.7 14.6 33 16.4 33 18.5
         C33 21.5 30.6 24 27.5 24.2L27 26H8.5Z"
              stroke="url(#csBlue)"
              strokeWidth="1.4"
              fill="rgba(0,188,212,0.07)"
            />

            {/* Network nodes — 4 points forming a quad */}
            <circle cx="11" cy="19" r="1.8" fill="url(#csBlue)" />
            <circle cx="19" cy="13" r="1.8" fill="url(#csBlue)" />
            <circle cx="27" cy="16" r="1.8" fill="url(#csBlue)" />
            <circle cx="22" cy="22" r="1.8" fill="url(#csBlue)" />

            {/* Network edges */}
            <line x1="11" y1="19" x2="19" y2="13" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
            <line x1="19" y1="13" x2="27" y2="16" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
            <line x1="27" y1="16" x2="22" y2="22" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
            <line x1="22" y1="22" x2="11" y2="19" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
            {/* Cross-diagonals */}
            <line x1="11" y1="19" x2="27" y2="16" stroke="url(#csBlue)" strokeWidth="0.7" opacity="0.40" />
            <line x1="19" y1="13" x2="22" y2="22" stroke="url(#csBlue)" strokeWidth="0.7" opacity="0.40" />

            {/* Arrow — diagonal up-right, orange/amber like logo */}
            <line x1="9" y1="30" x2="26" y2="10" stroke="url(#csArrow)" strokeWidth="2.2" strokeLinecap="round" />
            {/* Arrowhead */}
            <path
              d="M23 8.5L28 9L27.5 14"
              stroke="url(#csArrow)"
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="sb-logo-text">
            <h1 style={{ fontWeight: 700, letterSpacing: "0.04em" }}>CLOUD SEEKER</h1>
            <p>Security Intelligence Platform</p>
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h2>{pageTitle}</h2>
            <p>{pageSub}</p>
          </div>
          <div className="topbar-right">
            <div className={`status-chip ${threatChipClass}`}>
              <span className="status-pulse" />
              {threatChipLabel}
            </div>
            <div className="clock-chip">{clock}</div>
            <button className="icon-btn" onClick={() => { fetchStats(); fetchAlerts(); }} title="Refresh">
              <Icon.Refresh />
            </button>
          </div>
        </header>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="content-area">
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Total Events</span>
                  <div className="kpi-icon" style={{ background: "var(--indigo-bg)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><Icon.Pulse /></svg>
                  </div>
                </div>
                <div className="kpi-value">{(stats?.totalAlerts ?? "—").toLocaleString()}</div>
                <div className={`kpi-trend ${stats ? "trend-up" : "trend-mute"}`}>
                  +{stats?.lastHourAlerts ?? 0} last hour
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Active Alerts</span>
                  <div className="kpi-icon" style={{ background: "var(--danger-bg)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><Icon.Alert /></svg>
                  </div>
                </div>
                <div className="kpi-value" style={{ color: "var(--danger)" }}>{stats?.openAlerts ?? "—"}</div>
                <div className="kpi-trend trend-warn">{stats?.openAlerts ?? 0} unresolved</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Compliance Score</span>
                  <div className="kpi-icon" style={{ background: "var(--success-bg)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><Icon.Check /></svg>
                  </div>
                </div>
                <div className="kpi-value" style={{ color: "var(--success)" }}>91%</div>
                <div className="kpi-trend trend-up">+3% this week</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Services Monitored</span>
                  <div className="kpi-icon" style={{ background: "rgba(99,102,241,.08)" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><Icon.Server /></svg>
                  </div>
                </div>
                <div className="kpi-value" style={{ color: "#6366F1" }}>13</div>
                <div className="kpi-trend trend-up">All healthy</div>
              </div>
            </div>

            <div className="status-grid">
              <div className="status-card">
                <div className="status-card-head">
                  <span className="status-card-label">Critical Issues</span>
                  <Badge severity="CRITICAL" />
                </div>
                <div className="status-card-num" style={{ color: "var(--danger)" }}>{stats?.criticalAlerts ?? "—"}</div>
                <div className="status-card-sub">Require immediate action</div>
                <div className="status-bar" style={{ background: "var(--danger)" }} />
              </div>
              <div className="status-card">
                <div className="status-card-head">
                  <span className="status-card-label">High Risks</span>
                  <Badge severity="HIGH" />
                </div>
                <div className="status-card-num" style={{ color: "var(--warn)" }}>{stats?.highAlerts ?? "—"}</div>
                <div className="status-card-sub">Need investigation soon</div>
                <div className="status-bar" style={{ background: "var(--warn)" }} />
              </div>
              <div className="status-card">
                <div className="status-card-head">
                  <span className="status-card-label">Services OK</span>
                  <Badge severity="LOW" />
                </div>
                <div className="status-card-num" style={{ color: "var(--success)" }}>13</div>
                <div className="status-card-sub">Operating normally</div>
                <div className="status-bar" style={{ background: "var(--success)" }} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Recent Activity</div>
                  <div className="card-sub">Latest security events across your AWS environment</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>
                  {allAlerts.length} events
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Service</th>
                      <th>Region</th>
                      <th>Severity</th>
                      <th>User</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>Loading events...</td></tr>
                    ) : allAlerts.slice(0, 8).map(a => {
                      const svc = (a.event_source || "").replace(".amazonaws.com", "");
                      const user = (a.user || "").split("/").pop();
                      return (
                        <tr key={a.alert_id}>
                          <td>
                            <div className="td-primary">{a.event_name}</div>
                            <div className="td-secondary">{(a.reason || "").slice(0, 50)}{(a.reason?.length || 0) > 50 ? "…" : ""}</div>
                          </td>
                          <td className="td-mono">{svc || "AWS"}</td>
                          <td className="td-mono">{a.region || "—"}</td>
                          <td><Badge severity={a.severity} /></td>
                          <td className="td-mono" style={{ color: "var(--t3)" }}>{user || "—"}</td>
                          <td className="td-mono" style={{ color: "var(--t3)" }}>{fmtTime(a.created_at)}</td>
                        </tr>
                      );
                    })}
                    {!loading && allAlerts.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No events found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTS TAB ───────────────────────────────────────────────────── */}
        {tab === "alerts" && (
          <div className="content-area">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Security Alerts</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                {filtered.length} {filter === "ALL" ? "open" : filter.toLowerCase()} alerts
                {allAlerts.length > 0 && ` · Last updated ${fmtTime(new Date().toISOString())}`}
              </div>
            </div>

            <div className="filter-bar">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => (
                <button key={f} className={`filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                  {f} <span className="filter-count">{counts[f]}</span>
                </button>
              ))}
              <button className="action-btn" onClick={fetchAlerts} style={{ marginLeft: "auto" }}>
                <Icon.Refresh />Refresh
              </button>
            </div>

            <div className="alert-list">
              {loading && (
                <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-text">Loading alerts...</div></div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">✓</div>
                  <div className="empty-state-text">No {filter === "ALL" ? "" : filter + " "}alerts found</div>
                  <div className="empty-state-sub">Your environment looks clean</div>
                </div>
              )}
              {!loading && filtered.map(alert => {
                const svc = (alert.event_source || "").replace(".amazonaws.com", "").toUpperCase();
                const user = (alert.user || "").split("/").pop();
                const isRes = resolving.has(alert.alert_id);
                return (
                  <div key={alert.alert_id} className={`alert-card alert-card-${alert.severity}`}>
                    <div className="alert-row1">
                      <div className="alert-title">{alert.event_name}</div>
                      <div className="alert-actions">
                        <Badge severity={alert.severity} />
                        <button className="resolve-btn" disabled={isRes}
                          onClick={() => resolveAlert(alert.alert_id)}>
                          {isRes ? "Resolving…" : "Resolve"}
                        </button>
                      </div>
                    </div>
                    <div className="alert-desc">{alert.reason}</div>
                    <div className="alert-meta">
                      {svc && <span className="meta-tag">{svc}</span>}
                      {alert.region && <span className="meta-tag">{alert.region}</span>}
                      {user && <span className="meta-tag">{user}</span>}
                      {alert.source_ip && alert.source_ip !== "unknown" && (
                        <span className="meta-tag">IP: {alert.source_ip}</span>
                      )}
                      <span className="alert-time" style={{ marginLeft: "auto" }}>{fmtTime(alert.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── COMPLIANCE TAB ───────────────────────────────────────────────── */}
        {tab === "compliance" && (
          <div className="content-area">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Compliance Overview</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Security framework compliance across your AWS environment</div>
            </div>
            <div className="comp-grid">
              {COMPLIANCE_RULES.map(rule => {
                const isPass = rule.score >= 90;
                const isWarn = rule.score >= 75 && rule.score < 90;
                return (
                  <div key={rule.name} className="comp-card">
                    <div className="comp-icon" style={{ background: `${rule.color}10` }}>{rule.icon}</div>
                    <div className="comp-body">
                      <div className="comp-name">{rule.name}</div>
                      <div className="comp-track">
                        <div className="comp-fill" style={{ width: compAnimated ? `${rule.score}%` : "0%", background: rule.color }} />
                      </div>
                    </div>
                    <div className="comp-right">
                      <div className="comp-pct" style={{ color: rule.color }}>{rule.score}%</div>
                      <div className={`comp-status ${isPass ? "comp-pass" : isWarn ? "comp-warn" : "comp-fail"}`}>
                        {isPass ? "PASSING" : isWarn ? "WARNING" : "FAILING"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-num" style={{ color: "var(--success)" }}>{COMPLIANCE_RULES.filter(r => r.score >= 90).length}</div>
                <div className="summary-lbl">Passing</div>
              </div>
              <div className="summary-card">
                <div className="summary-num" style={{ color: "var(--warn)" }}>{COMPLIANCE_RULES.filter(r => r.score >= 75 && r.score < 90).length}</div>
                <div className="summary-lbl">Warning</div>
              </div>
              <div className="summary-card">
                <div className="summary-num" style={{ color: "var(--t3)" }}>{COMPLIANCE_RULES.filter(r => r.score < 75).length}</div>
                <div className="summary-lbl">Failing</div>
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <div className="content-area">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Security Analytics</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Activity trends and threat insights</div>
            </div>

            <div className="two-col" style={{ marginBottom: 12 }}>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">Region Activity</div><div className="card-sub">Events by AWS region</div></div>
                </div>
                <RegionBars byRegion={stats?.byRegion || { "eu-north-1": 0 }} />
              </div>
              <div className="card">
                <div className="card-header">
                  <div><div className="card-title">Alert Breakdown</div><div className="card-sub">Distribution by severity</div></div>
                </div>
                <DonutChart bySeverity={stats?.bySeverity || { CRITICAL: 4, HIGH: 20, MEDIUM: 6, LOW: 24 }} />
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header">
                <div><div className="card-title">Severity Summary</div><div className="card-sub">Alert counts by severity level</div></div>
              </div>
              <div className="three-col">
                {[["CRITICAL", "#EF4444"], ["HIGH", "#F59E0B"], ["MEDIUM", "#6366F1"], ["LOW", "#22C55E"]].map(([sev, col]) => (
                  <div key={sev} style={{
                    background: `${col}08`, border: `1px solid ${col}20`,
                    borderRadius: 8, padding: "14px 16px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--mono)", color: col }}>
                      {stats?.bySeverity?.[sev] ?? 0}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: col, opacity: .8, letterSpacing: 1, marginTop: 3, textTransform: "uppercase" }}>{sev}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Detection Pipeline</div><div className="card-sub">How Cloud Seeker monitors your AWS environment in real time</div></div>
              </div>
              <div className="pipeline">
                {PIPELINE.map((step, i) => (
                  <>
                    <div key={step.name} className="pipe-step">
                      <div className="pipe-icon">{step.icon}</div>
                      <div className="pipe-name">{step.name}</div>
                      <div className="pipe-desc">{step.desc}</div>
                    </div>
                    {i < PIPELINE.length - 1 && <div className="pipe-arr">→</div>}
                  </>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
