/**
 * Cloud Seeker — Dashboard v10
 * Animated filter pills + animated KPI metric cards + animated status cards
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNotifications } from "./NotificationManager";

const API = process.env.REACT_APP_API_URL || "";

const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};
const fmtFullTime = () =>
  new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

const I = {
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
  TrendUp: () => <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>,
};

function CloudSeekerLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="csBlue" x1="0" y1="36" x2="36" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0D47A1" /><stop offset="50%" stopColor="#0288D1" /><stop offset="100%" stopColor="#00BCD4" />
        </linearGradient>
        <linearGradient id="csArrow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF6D00" /><stop offset="100%" stopColor="#FFD600" />
        </linearGradient>
      </defs>
      <path d="M8.5 26C5.5 26 3 23.6 3 20.5C3 17.8 5 15.6 7.6 15.1C7.5 14.8 7.5 14.4 7.5 14C7.5 11.0 10.0 8.5 13.0 8.5C13.9 8.5 14.8 8.7 15.6 9.2C16.8 6.9 19.2 5.3 22.0 5.3C26.4 5.3 30 8.9 30 13.3C30 13.5 30 13.7 29.9 13.9C31.7 14.6 33 16.4 33 18.5C33 21.5 30.6 24 27.5 24.2L27 26H8.5Z"
        stroke="url(#csBlue)" strokeWidth="1.4" fill="rgba(0,188,212,0.07)" />
      <circle cx="11" cy="19" r="1.8" fill="url(#csBlue)" /><circle cx="19" cy="13" r="1.8" fill="url(#csBlue)" />
      <circle cx="27" cy="16" r="1.8" fill="url(#csBlue)" /><circle cx="22" cy="22" r="1.8" fill="url(#csBlue)" />
      <line x1="11" y1="19" x2="19" y2="13" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
      <line x1="19" y1="13" x2="27" y2="16" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
      <line x1="27" y1="16" x2="22" y2="22" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
      <line x1="22" y1="22" x2="11" y2="19" stroke="url(#csBlue)" strokeWidth="0.9" opacity="0.75" />
      <line x1="9" y1="30" x2="26" y2="10" stroke="url(#csArrow)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23 8.5L28 9L27.5 14" stroke="url(#csArrow)" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Badge({ severity }) {
  return (
    <span className={`badge badge-${severity}`}>
      <span className="badge-dot" />{severity}
    </span>
  );
}

// ── ════════════════ ANIMATED KPI CARD ════════════════ ──────────────────────
function KpiCard({ label, value, sub, subColor, icon, variant, trendArrowColor, bars }) {
  const cfg = {
    teal: { iconBg: "rgba(20,184,166,.18)", iconColor: "#2DD4BF", glow: "rgba(20,184,166,.6)" },
    red: { iconBg: "rgba(239,68,68,.18)", iconColor: "#F87171", glow: "rgba(239,68,68,.6)" },
    green: { iconBg: "rgba(34,197,94,.18)", iconColor: "#6EE7B7", glow: "rgba(34,197,94,.6)" },
    indigo: { iconBg: "rgba(99,102,241,.18)", iconColor: "#A5B4FC", glow: "rgba(99,102,241,.6)" },
  }[variant] || {};

  // Default bar heights if not supplied
  const barData = bars || [
    { h: "40%", color: cfg.iconColor + "60" },
    { h: "65%", color: cfg.iconColor + "80" },
    { h: "55%", color: cfg.iconColor + "70" },
    { h: "80%", color: cfg.iconColor },
  ];

  return (
    <div className="kpi-card" data-v={variant}>
      <div className="kpi-inner">
        {/* Left: icon + text */}
        <div className="kpi-icon-section">
          <div className="kpi-icon-wrap" style={{ background: cfg.iconBg, color: cfg.iconColor }}>
            <div className="kpi-icon-glow" style={{ background: cfg.glow }} />
            {icon}
          </div>
          <div className="kpi-text">
            <div className="kpi-label" style={{ color: cfg.iconColor }}>
              {label}
              <svg className="kpi-trend-arrow" viewBox="0 0 24 24" style={{ color: trendArrowColor || cfg.iconColor }}>
                <I.TrendUp />
              </svg>
            </div>
            <div className="kpi-value">{value}</div>
            <div className="kpi-sub">
              <div className="kpi-sub-dot" style={{ background: subColor || cfg.iconColor }} />
              <span className="kpi-sub-text" style={{ color: subColor || cfg.iconColor }}>{sub}</span>
            </div>
          </div>
        </div>
        {/* Right: mini bars */}
        <div className="kpi-bars-section">
          {barData.map((b, i) => (
            <div key={i} className="kpi-mini-bar">
              <div className="kpi-bar-track">
                <div className="kpi-bar-fill" style={{ height: b.h, background: b.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ════════════════ ANIMATED FILTER BUTTON ═══════════ ──────────────────────
function FilterBtn({ label, count, isActive, onClick }) {
  const COLOR = {
    ALL: "#818CF8",
    CRITICAL: "#F87171",
    HIGH: "#FCD34D",
    MEDIUM: "#FDE68A",
    LOW: "#6EE7B7",
  };
  return (
    <button
      className={`filter-btn${isActive ? " active" : ""}`}
      data-f={label}
      onClick={onClick}
      style={isActive ? { color: COLOR[label] } : {}}
    >
      {label} <span className="filter-count">{count}</span>
    </button>
  );
}

// ── Nav + chart components (same as v9) ──────────────────────────────────────
function NavButton({ item, isActive, badgeCount, onClick }) {
  const [hovered, setHovered] = useState(false);
  const show = isActive || hovered;
  const showBadge = item.badge && badgeCount > 0;
  return (
    <div className={`nav-item${isActive ? " active" : ""}`}
      onClick={item.disabled ? undefined : (onClick || item.onClick)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? "default" : "pointer" }}>
      <div className="nav-inner" style={{
        background: show ? `linear-gradient(135deg, ${item.iconBg} 0%, rgba(255,255,255,0.03) 100%)` : "rgba(255,255,255,0.02)",
        borderColor: show ? `${item.color}30` : "rgba(255,255,255,0.04)",
        transform: hovered && !isActive ? "translateX(3px)" : "translateX(0)",
      }}>
        {isActive && <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: "0 2px 2px 0", background: item.color, boxShadow: `0 0 8px ${item.color}` }} />}
        <div className="nav-icon-box" style={{ background: show ? `linear-gradient(135deg, ${item.iconBg}, ${item.iconBg.replace(",.15)", ", .25)")})` : item.iconBg, color: item.color, boxShadow: show ? `0 0 12px ${item.glow}` : "none" }}>
          {item.icon}
        </div>
        <div className="nav-label-wrap">
          <span className="nav-label-main" style={{ color: show ? item.color : "var(--t1)" }}>{item.label}</span>
          <span className="nav-label-sub" style={{ color: show ? item.color : "var(--t3)", opacity: show ? 0.7 : 1 }}>{item.sub}</span>
        </div>
        {showBadge ? (
          <div style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: -3, borderRadius: "50%", background: item.color, opacity: 0.35, animation: "nav-ping 1.2s cubic-bezier(0,0,.2,1) infinite" }} />
            <div style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: item.color, color: "white", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, boxShadow: `0 0 10px ${item.glow}` }}>
              {badgeCount > 99 ? "99" : badgeCount}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto", flexShrink: 0 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: item.dotColors[i], transition: `transform .2s ${i * .05}s`, transform: show ? "scale(1.4)" : "scale(1)" }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MAIN_NAV = [
  { id: "overview", label: "Overview", sub: "Security dashboard", icon: <I.Grid />, color: "#6366F1", glow: "rgba(99,102,241,.5)", iconBg: "rgba(99,102,241,.15)", dotColors: ["#6366F1", "rgba(99,102,241,.5)", "rgba(99,102,241,.25)"] },
  { id: "alerts", label: "Alerts", sub: "Security events", icon: <I.Bell />, color: "#EF4444", glow: "rgba(239,68,68,.5)", iconBg: "rgba(239,68,68,.15)", dotColors: ["#EF4444", "rgba(239,68,68,.5)", "rgba(239,68,68,.25)"], badge: true },
  { id: "compliance", label: "Compliance", sub: "Framework scores", icon: <I.Shield />, color: "#22C55E", glow: "rgba(34,197,94,.5)", iconBg: "rgba(34,197,94,.15)", dotColors: ["#22C55E", "rgba(34,197,94,.5)", "rgba(34,197,94,.25)"] },
  { id: "analytics", label: "Analytics", sub: "Trends & insights", icon: <I.Chart />, color: "#06B6D4", glow: "rgba(6,182,212,.5)", iconBg: "rgba(6,182,212,.15)", dotColors: ["#06B6D4", "rgba(6,182,212,.5)", "rgba(6,182,212,.25)"] },
];
const SYS_NAV = [
  { id: "aws", label: "AWS Console", sub: "Open in new tab", icon: <I.Link />, color: "#F59E0B", glow: "rgba(245,158,11,.5)", iconBg: "rgba(245,158,11,.15)", dotColors: ["#F59E0B", "rgba(245,158,11,.5)", "rgba(245,158,11,.25)"], onClick: () => window.open("https://console.aws.amazon.com", "_blank") },
  { id: "settings", label: "Settings", sub: "Configure platform", icon: <I.Gear />, color: "#64748B", glow: "rgba(100,116,139,.4)", iconBg: "rgba(100,116,139,.12)", dotColors: ["#64748B", "rgba(100,116,139,.4)", "rgba(100,116,139,.2)"], disabled: true },
];

function DonutChart({ bySeverity }) {
  const segs = [{ key: "CRITICAL", color: "#EF4444" }, { key: "HIGH", color: "#F59E0B" }, { key: "MEDIUM", color: "#6366F1" }, { key: "LOW", color: "#22C55E" }];
  const total = Object.values(bySeverity).reduce((s, v) => s + v, 0) || 1;
  let offset = 25;
  return (
    <div className="donut-wrap">
      <svg width="100" height="100" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="transparent" stroke="rgba(255,255,255,.05)" strokeWidth="3" />
        {segs.map(s => {
          const pct = ((bySeverity[s.key] || 0) / total) * 100;
          const el = <circle key={s.key} cx="18" cy="18" r="15.9155" fill="transparent" stroke={s.color} strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} style={{ transition: "stroke-dasharray 1s ease" }} />;
          offset -= pct; return el;
        })}
      </svg>
      <div className="donut-legend">
        {segs.map(s => (<div key={s.key} className="leg-item"><div className="leg-dot" style={{ background: s.color }} /><span className="leg-label">{s.key}</span><span className="leg-count">{bySeverity[s.key] || 0}</span></div>))}
      </div>
    </div>
  );
}

function RegionBars({ byRegion }) {
  const COLORS = { "eu-north-1": "#4F46E5", "us-east-1": "#6366F1", "us-west-2": "#22C55E", "eu-west-1": "#F59E0B", "ap-southeast-1": "#EC4899", "eu-central-1": "#06B6D4", "ap-south-1": "#8B5CF6", "us-east-2": "#10B981" };
  const entries = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);
  if (!entries.length) return <div className="empty-state"><div className="empty-state-text">No region data yet</div></div>;
  return (
    <div className="bar-group">
      {entries.slice(0, 6).map(([r, c]) => (
        <div key={r} className="bar-row">
          <div className="bar-label">{r}</div>
          <div className="bar-track"><div className="bar-fill" style={{ width: animated ? `${(c / max) * 100}%` : "0%", background: COLORS[r] || "#6366F1" }} /></div>
          <div className="bar-count">{c}</div>
        </div>
      ))}
    </div>
  );
}

const COMPLIANCE_FRAMEWORKS = [
  { name: "CIS AWS Benchmark", icon: "🏛️", score: 94, color: "#4F46E5" },
  { name: "PCI DSS", icon: "💳", score: 87, color: "#F59E0B" },
  { name: "SOC 2", icon: "✅", score: 96, color: "#22C55E" },
  { name: "HIPAA", icon: "🏥", score: 89, color: "#F59E0B" },
  { name: "NIST 800-53", icon: "🔒", score: 78, color: "#64748B" },
  { name: "AWS Well-Architected", icon: "☁️", score: 92, color: "#6366F1" },
];

const PIPELINE = [
  { icon: "🖥️", name: "AWS Action", desc: "Console / API change" },
  { icon: "📋", name: "CloudTrail", desc: "Records every API call" },
  { icon: "⚡", name: "EventBridge", desc: "Detects in ~30s" },
  { icon: "λ", name: "Lambda", desc: "Analyzes threat level" },
  { icon: "🗄️", name: "DynamoDB", desc: "Stores alert record" },
  { icon: "📧", name: "SNS Email", desc: "Sends to Gmail" },
  { icon: "📊", name: "Dashboard", desc: "Real-time view" },
];

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
  const [compAnim, setCompAnim] = useState(false);
  const [threatLevel, setThreat] = useState("LOW");
  const seenIds = useRef(new Set());

  useEffect(() => { const t = setInterval(() => setClock(fmtFullTime()), 1000); return () => clearInterval(t); }, []);

  const fetchStats = useCallback(async () => {
    if (!API) { setStats({ totalAlerts: 10, openAlerts: 10, lastHourAlerts: 0, criticalAlerts: 2, highAlerts: 2, bySeverity: { CRITICAL: 2, HIGH: 2, MEDIUM: 2, LOW: 4 }, byRegion: { "eu-north-1": 10 } }); return; }
    try { const r = await fetch(`${API}/stats`); if (r.ok) setStats(await r.json()); } catch { }
  }, []);

  const fetchAlerts = useCallback(async () => {
    let items = [];
    if (!API) {
      items = [
        { alert_id: "d1", event_name: "AuthorizeSecurityGroupIngress", reason: "SG opened to ENTIRE INTERNET (0.0.0.0/0) port 22", severity: "CRITICAL", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date().toISOString(), status: "OPEN" },
        { alert_id: "d2", event_name: "TerminateInstances", reason: "EC2 instance TERMINATED in eu-north-1", severity: "HIGH", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 300000).toISOString(), status: "OPEN" },
        { alert_id: "d3", event_name: "RunInstances", reason: "EC2 t3.micro launched by Jithu", severity: "HIGH", event_source: "ec2.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 600000).toISOString(), status: "OPEN" },
        { alert_id: "d4", event_name: "PutBucketPolicy", reason: "S3 bucket policy changed", severity: "HIGH", event_source: "s3.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 900000).toISOString(), status: "OPEN" },
        { alert_id: "d5", event_name: "UpdateTrail", reason: "CloudTrail configuration changed", severity: "MEDIUM", event_source: "cloudtrail.amazonaws.com", region: "eu-north-1", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 1200000).toISOString(), status: "OPEN" },
        { alert_id: "d6", event_name: "CreateAccessKey", reason: "New access key created for Jithu", severity: "MEDIUM", event_source: "iam.amazonaws.com", region: "global", user: "Jithu", source_ip: "103.42.196.77", created_at: new Date(Date.now() - 1500000).toISOString(), status: "OPEN" },
      ];
    } else {
      try { const r = await fetch(`${API}/alerts?limit=100&status=OPEN`); if (r.ok) { const d = await r.json(); items = d.alerts || []; } } catch { }
    }
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    items.forEach(a => {
      if (!seenIds.current.has(a.alert_id)) {
        addNotification({ severity: a.severity, title: a.event_name, detail: a.reason, region: a.region, user: a.user?.split("/").pop() });
        seenIds.current.add(a.alert_id);
      }
    });
    setAllAlerts(items); setLoading(false);
    const crit = items.filter(a => a.severity === "CRITICAL").length;
    const high = items.filter(a => a.severity === "HIGH").length;
    setThreat(crit > 0 ? "CRITICAL" : high > 0 ? "HIGH" : "LOW");
  }, [addNotification]);

  useEffect(() => {
    fetchStats(); fetchAlerts();
    const si = setInterval(fetchStats, 60_000);
    const ai = setInterval(fetchAlerts, 15_000);
    return () => { clearInterval(si); clearInterval(ai); };
  }, [fetchStats, fetchAlerts]);

  const resolveAlert = async (id) => {
    setResolving(prev => new Set([...prev, id]));
    if (API) { try { await fetch(`${API}/alerts/${id}/resolve`, { method: "POST" }); } catch { } }
    setAllAlerts(prev => prev.filter(a => a.alert_id !== id));
    setResolving(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const counts = { ALL: allAlerts.length, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  allAlerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });
  const filtered = filter === "ALL" ? allAlerts : allAlerts.filter(a => a.severity === filter);

  const threatClass = threatLevel === "CRITICAL" ? "status-crit" : threatLevel === "HIGH" ? "status-warn" : "status-ok";
  const threatLabel = threatLevel === "CRITICAL" ? "Threat: Critical" : threatLevel === "HIGH" ? "Threat: High" : "All Clear";

  const PAGE_META = {
    overview: ["Cloud Security Overview", "Real-time monitoring of your AWS environment"],
    alerts: ["Security Alerts", "Manage and respond to security events"],
    compliance: ["Compliance Overview", "Security framework compliance status"],
    analytics: ["Security Analytics", "Activity trends and environment insights"],
  };
  const [pageTitle, pageSub] = PAGE_META[tab];

  const switchTab = (t) => {
    setTab(t); setFilter("ALL");
    if (t === "compliance") setTimeout(() => setCompAnim(true), 120);
    else setCompAnim(false);
  };

  // KPI bar presets per card
  const kpiBars = {
    teal: [{ h: "40%", color: "#2DD4BF44" }, { h: "65%", color: "#2DD4BF66" }, { h: "50%", color: "#2DD4BF55" }, { h: "80%", color: "#2DD4BF" }],
    red: [{ h: "50%", color: "#F8717144" }, { h: "70%", color: "#F8717166" }, { h: "45%", color: "#F8717155" }, { h: "90%", color: "#F87171" }],
    green: [{ h: "60%", color: "#6EE7B744" }, { h: "80%", color: "#6EE7B766" }, { h: "55%", color: "#6EE7B755" }, { h: "70%", color: "#6EE7B7" }],
    indigo: [{ h: "45%", color: "#A5B4FC44" }, { h: "60%", color: "#A5B4FC66" }, { h: "75%", color: "#A5B4FC55" }, { h: "55%", color: "#A5B4FC" }],
  };

  return (
    <div className="app-layout">

      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar">
        <div className="sb-logo">
          <CloudSeekerLogo size={36} />
          <div className="sb-logo-text"><h1>CLOUD SEEKER</h1><p>Security Intelligence Platform</p></div>
        </div>
        <div className="sb-nav">
          <div className="sb-section">Main</div>
          {MAIN_NAV.map(item => (
            <NavButton key={item.id} item={item} isActive={tab === item.id} badgeCount={item.badge ? counts.ALL : 0} onClick={() => switchTab(item.id)} />
          ))}
          <div className="sb-section" style={{ marginTop: 14 }}>System</div>
          {SYS_NAV.map(item => (<NavButton key={item.id} item={item} isActive={false} badgeCount={0} />))}
        </div>
        <div className="sb-footer">
          <div className="env-pill">
            <div className="env-dot" />
            <div><div className="env-label">AWS Connected</div><div className="env-sub">eu-north-1 · prod</div></div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left"><h2>{pageTitle}</h2><p>{pageSub}</p></div>
          <div className="topbar-right">
            <div className={`status-chip ${threatClass}`}><span className="status-pulse" />{threatLabel}</div>
            <div className="clock-chip">{clock}</div>
            <button className="icon-btn" onClick={() => { fetchStats(); fetchAlerts(); }} title="Refresh"><I.Refresh /></button>
          </div>
        </header>

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (
          <div className="content-area">
            {/* ── ANIMATED KPI CARDS ── */}
            <div className="kpi-grid">
              <KpiCard
                label="TOTAL EVENTS" variant="teal"
                value={stats?.totalAlerts?.toLocaleString() ?? "—"}
                sub={`+ ${stats?.lastHourAlerts ?? 0} last hour`}
                subColor="#2DD4BF"
                bars={kpiBars.teal}
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><I.Pulse /></svg>}
              />
              <KpiCard
                label="ACTIVE ALERTS" variant="red"
                value={stats?.openAlerts ?? "—"}
                sub={`${stats?.openAlerts ?? 0} unresolved`}
                subColor="#F87171"
                bars={kpiBars.red}
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><I.Alert /></svg>}
              />
              <KpiCard
                label="COMPLIANCE SCORE" variant="green"
                value="91%"
                sub="+3% this week"
                subColor="#6EE7B7"
                bars={kpiBars.green}
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><I.Check /></svg>}
              />
              <KpiCard
                label="SERVICES MONITORED" variant="indigo"
                value="13"
                sub="All healthy"
                subColor="#A5B4FC"
                bars={kpiBars.indigo}
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><I.Server /></svg>}
              />
            </div>

            {/* ── ANIMATED STATUS CARDS ── */}
            <div className="status-grid">
              <div className="status-card" data-v="crit">
                <div className="status-card-head">
                  <span className="status-card-label">Critical Issues</span>
                  <Badge severity="CRITICAL" />
                </div>
                <div className="status-card-num" style={{ color: "var(--danger)" }}>{stats?.criticalAlerts ?? "—"}</div>
                <div className="status-card-sub">Require immediate action</div>
                <div className="status-bar" style={{ background: "var(--danger)" }} />
              </div>
              <div className="status-card" data-v="high">
                <div className="status-card-head">
                  <span className="status-card-label">High Risks</span>
                  <Badge severity="HIGH" />
                </div>
                <div className="status-card-num" style={{ color: "var(--warn)" }}>{stats?.highAlerts ?? "—"}</div>
                <div className="status-card-sub">Need investigation soon</div>
                <div className="status-bar" style={{ background: "var(--warn)" }} />
              </div>
              <div className="status-card" data-v="ok">
                <div className="status-card-head">
                  <span className="status-card-label">Services OK</span>
                  <Badge severity="LOW" />
                </div>
                <div className="status-card-num" style={{ color: "var(--success)" }}>13</div>
                <div className="status-card-sub">Operating normally</div>
                <div className="status-bar" style={{ background: "var(--success)" }} />
              </div>
            </div>

            {/* ── RECENT ACTIVITY TABLE ── */}
            <div className="card">
              <div className="card-header">
                <div><div className="card-title">Recent Activity</div><div className="card-sub">Latest security events across your AWS environment</div></div>
                <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>{allAlerts.length} events</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Event</th><th>Service</th><th>Region</th><th>Severity</th><th>User</th><th>Time</th></tr></thead>
                  <tbody>
                    {loading && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>Loading events...</td></tr>}
                    {!loading && allAlerts.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--t3)", padding: 24 }}>No events — system clean ✓</td></tr>}
                    {!loading && allAlerts.slice(0, 8).map(a => {
                      const svc = (a.event_source || "").replace(".amazonaws.com", "");
                      const user = (a.user || "").split("/").pop();
                      return (
                        <tr key={a.alert_id}>
                          <td><div className="td-primary">{a.event_name}</div><div className="td-secondary">{(a.reason || "").slice(0, 52)}{(a.reason?.length || 0) > 52 ? "…" : ""}</div></td>
                          <td className="td-mono">{svc || "AWS"}</td>
                          <td className="td-mono">{a.region || "—"}</td>
                          <td><Badge severity={a.severity} /></td>
                          <td className="td-mono" style={{ color: "var(--t3)" }}>{user || "—"}</td>
                          <td className="td-mono" style={{ color: "var(--t3)" }}>{fmtTime(a.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ ALERTS ══ */}
        {tab === "alerts" && (
          <div className="content-area">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Security Alerts</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>{filtered.length} {filter === "ALL" ? "open" : filter.toLowerCase()} alerts{allAlerts.length > 0 && " · refreshes every 15s"}</div>
            </div>

            {/* ── ANIMATED FILTER PILLS ── */}
            <div className="filter-bar">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => (
                <FilterBtn key={f} label={f} count={counts[f]} isActive={filter === f} onClick={() => setFilter(f)} />
              ))}
              <button className="action-btn" style={{ marginLeft: "auto" }} onClick={fetchAlerts}><I.Refresh />Refresh</button>
            </div>

            <div className="alert-list">
              {loading && <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-text">Loading alerts…</div></div>}
              {!loading && filtered.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ opacity: 1, fontSize: 32 }}>✓</div>
                  <div className="empty-state-text" style={{ color: "var(--success)" }}>No {filter === "ALL" ? "" : filter + " "}alerts</div>
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
                        <button className="resolve-btn" disabled={isRes} onClick={() => resolveAlert(alert.alert_id)}>{isRes ? "Resolving…" : "Resolve"}</button>
                      </div>
                    </div>
                    <div className="alert-desc">{alert.reason}</div>
                    <div className="alert-meta">
                      {svc && <span className="meta-tag">{svc}</span>}
                      {alert.region && <span className="meta-tag">{alert.region}</span>}
                      {user && <span className="meta-tag">{user}</span>}
                      {alert.source_ip && alert.source_ip !== "unknown" && <span className="meta-tag">IP: {alert.source_ip}</span>}
                      <span className="alert-time" style={{ marginLeft: "auto" }}>{fmtTime(alert.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ COMPLIANCE ══ */}
        {tab === "compliance" && (
          <div className="content-area">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Compliance Overview</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Security framework compliance across your AWS environment</div>
            </div>
            <div style={{ background: "linear-gradient(135deg,rgba(79,70,229,.08),rgba(34,197,94,.06))", border: "1px solid rgba(79,70,229,.2)", borderRadius: "var(--r)", padding: "20px 24px", marginBottom: 16, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 700, fontFamily: "var(--mono)", color: "#22C55E", lineHeight: 1 }}>91%</div>
                <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, letterSpacing: "0.06em" }}>OVERALL SCORE</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>AWS Security Posture</div>
                <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>Compliance tracked across {COMPLIANCE_FRAMEWORKS.length} security frameworks. {COMPLIANCE_FRAMEWORKS.filter(f => f.score >= 90).length} passing, {COMPLIANCE_FRAMEWORKS.filter(f => f.score >= 75 && f.score < 90).length} need attention.</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[{ n: COMPLIANCE_FRAMEWORKS.filter(f => f.score >= 90).length, label: "Passing", color: "var(--success)" }, { n: COMPLIANCE_FRAMEWORKS.filter(f => f.score >= 75 && f.score < 90).length, label: "Warning", color: "var(--warn)" }, { n: COMPLIANCE_FRAMEWORKS.filter(f => f.score < 75).length, label: "Failing", color: "var(--danger)" }].map(s => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", textAlign: "center", minWidth: 70 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: s.color }}>{s.n}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2, letterSpacing: "0.06em" }}>{s.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="comp-grid">
              {COMPLIANCE_FRAMEWORKS.map(fw => {
                const isPass = fw.score >= 90; const isWarn = fw.score >= 75 && fw.score < 90;
                return (
                  <div key={fw.name} className="comp-card">
                    <div className="comp-icon" style={{ background: `${fw.color}18` }}>{fw.icon}</div>
                    <div className="comp-body">
                      <div className="comp-name">{fw.name}</div>
                      <div className="comp-track"><div className="comp-fill" style={{ width: compAnim ? `${fw.score}%` : "0%", background: fw.color }} /></div>
                    </div>
                    <div className="comp-right">
                      <div className="comp-pct" style={{ color: fw.color }}>{fw.score}%</div>
                      <div className={`comp-status ${isPass ? "comp-pass" : isWarn ? "comp-warn" : "comp-fail"}`}>{isPass ? "PASSING" : isWarn ? "WARNING" : "FAILING"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ANALYTICS ══ */}
        {tab === "analytics" && (
          <div className="content-area">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>Security Analytics</div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Activity trends and threat insights</div>
            </div>
            <div className="two-col" style={{ marginBottom: 12 }}>
              <div className="card"><div className="card-header"><div><div className="card-title">Region Activity</div><div className="card-sub">Events by AWS region</div></div></div><RegionBars byRegion={stats?.byRegion || { "eu-north-1": 0 }} /></div>
              <div className="card"><div className="card-header"><div><div className="card-title">Alert Breakdown</div><div className="card-sub">Distribution by severity</div></div></div><DonutChart bySeverity={stats?.bySeverity || { CRITICAL: 2, HIGH: 2, MEDIUM: 2, LOW: 4 }} /></div>
            </div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><div><div className="card-title">Severity Summary</div><div className="card-sub">Alert counts by severity level</div></div></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[["CRITICAL", "#EF4444"], ["HIGH", "#F59E0B"], ["MEDIUM", "#6366F1"], ["LOW", "#22C55E"]].map(([sev, col]) => (
                  <div key={sev} style={{ background: `${col}08`, border: `1px solid ${col}20`, borderRadius: 8, padding: "14px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)", color: col }}>{stats?.bySeverity?.[sev] ?? 0}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: col, opacity: .8, letterSpacing: 1, marginTop: 4, textTransform: "uppercase" }}>{sev}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><div><div className="card-title">Detection Pipeline</div><div className="card-sub">How Cloud Seeker monitors your AWS environment</div></div></div>
              <div className="pipeline">
                {PIPELINE.map((step, i) => (
                  <span key={step.name} style={{ display: "contents" }}>
                    <div className="pipe-step"><div className="pipe-icon">{step.icon}</div><div className="pipe-name">{step.name}</div><div className="pipe-desc">{step.desc}</div></div>
                    {i < PIPELINE.length - 1 && <div className="pipe-arr">→</div>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
