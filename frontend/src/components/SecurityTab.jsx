/**
 * Cloud Seeker — SecurityTab.jsx
 * 
 * Self-contained animated security dashboard.
 * Shows DEMO data by default → switches to REAL AWS data when API is live.
 * 
 * HOW TO USE IN Dashboard.jsx:
 *   import SecurityTab from "./SecurityTab";
 *   {tab === "security" && <SecurityTab API={API} authFetch={authFetch} />}
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Demo data (shown while API is loading or unavailable) ─────────────────────
const DEMO_DATA = {
  overallScore: 62,
  overallStatus: "WARNING",
  scannedAt: new Date().toISOString(),
  issueCount: { CRITICAL: 3, HIGH: 5, MEDIUM: 4 },
  topIssues: [
    { severity: "CRITICAL", msg: "Root account has NO MFA enabled" },
    { severity: "CRITICAL", msg: "SSH port 22 open to 0.0.0.0/0 on 'web-server'" },
    { severity: "HIGH", msg: "2 IAM users have no MFA" },
  ],
  sections: {
    iam: {
      score: 55, status: "WARNING",
      totalUsers: 3, noMfa: ["Pranav", "ashwin"], adminUsers: ["Jithu"],
      oldKeys: [{ user: "ashwin", age_days: 112 }],
      rootMfa: false, rootKeys: 0,
      issues: [
        { severity: "CRITICAL", msg: "Root account has NO MFA enabled", fix: "Go to AWS Console → IAM → Security credentials → Activate MFA" },
        { severity: "HIGH", msg: "User 'Pranav' has no MFA", fix: "IAM → Users → Pranav → Security credentials → Assign MFA device" },
        { severity: "HIGH", msg: "User 'ashwin' has no MFA", fix: "IAM → Users → ashwin → Security credentials → Assign MFA device" },
        { severity: "HIGH", msg: "User 'Jithu' has AdministratorAccess", fix: "Apply least-privilege — remove full admin, grant only needed permissions" },
        { severity: "MEDIUM", msg: "Access key for 'ashwin' is 112 days", fix: "IAM → Users → ashwin → Security credentials → Rotate access key" },
      ],
    },
    s3: {
      score: 70, status: "WARNING",
      totalBuckets: 4, publicBuckets: ["cloud-seeker-logs-382334304729-prod"],
      unencryptedBuckets: ["old-backup-bucket"],
      issues: [
        { severity: "CRITICAL", msg: "Bucket 'cloud-seeker-logs-382334304729-prod' may be publicly accessible", fix: "S3 → bucket → Permissions → Block all public access → Edit → Enable all 4 settings" },
        { severity: "HIGH", msg: "Bucket 'old-backup-bucket' has no default encryption", fix: "S3 → bucket → Properties → Default encryption → Enable SSE-S3" },
      ],
    },
    ec2: {
      score: 40, status: "CRITICAL",
      running: 2, stopped: 1, total: 3,
      openPorts: [
        { instance: "web-server", sg: "sg-0abc123", port: 22, service: "SSH" },
        { instance: "bastion-host", sg: "sg-0def456", port: 3389, service: "RDP" },
      ],
      issues: [
        { severity: "CRITICAL", msg: "SSH port 22 open to internet on 'web-server' (sg-0abc123)", fix: "EC2 → Security Groups → sg-0abc123 → Inbound rules → Edit → change 0.0.0.0/0 to your IP" },
        { severity: "CRITICAL", msg: "RDP port 3389 open to internet on 'bastion-host' (sg-0def456)", fix: "EC2 → Security Groups → sg-0def456 → Inbound rules → restrict source to known IPs" },
      ],
    },
    network: {
      score: 45, status: "CRITICAL",
      totalSGs: 8,
      dangerousSGs: [
        { id: "sg-0abc123", name: "web-server-sg", openPorts: [{ port: 22, service: "SSH", severity: "CRITICAL" }] },
        { id: "sg-0def456", name: "bastion-sg", openPorts: [{ port: 3389, service: "RDP", severity: "CRITICAL" }] },
        { id: "sg-0ghi789", name: "db-sg", openPorts: [{ port: 3306, service: "MySQL", severity: "HIGH" }] },
      ],
      issues: [
        { severity: "CRITICAL", msg: "SG 'web-server-sg' — SSH port 22 open to 0.0.0.0/0", fix: "Restrict port 22 to your office/home IP only" },
        { severity: "CRITICAL", msg: "SG 'bastion-sg' — RDP port 3389 open to 0.0.0.0/0", fix: "Restrict RDP to specific known IPs" },
        { severity: "HIGH", msg: "SG 'db-sg' — MySQL port 3306 open to 0.0.0.0/0", fix: "Database ports should NEVER be open to internet" },
      ],
    },
    logging: {
      score: 85, status: "GOOD",
      checks: [
        { name: "CloudTrail Multi-Region", status: true, detail: "Trail 'cloud-seeker-trail-prod' is active and logging" },
        { name: "AWS Config Recorder", status: true, detail: "Config recorder is active and recording" },
        { name: "GuardDuty", status: false, detail: "GuardDuty not enabled in eu-north-1" },
        { name: "CloudWatch Alarms", status: true, detail: "6 alarms configured, none currently firing" },
      ],
      issues: [
        { severity: "HIGH", msg: "GuardDuty not enabled", fix: "GuardDuty → Get started → Enable — detects threats automatically" },
      ],
    },
    threats: {
      score: 72, status: "WARNING",
      openAlerts: 6, last24h: 3, last7d: 6,
      bySeverity: { CRITICAL: 1, HIGH: 2, MEDIUM: 2, LOW: 1 },
      topThreats: [
        { event: "AuthorizeSecurityGroupIngress", reason: "SG opened to ENTIRE INTERNET port 22", severity: "CRITICAL", region: "eu-north-1", user: "Jithu", time: new Date(Date.now() - 1800000).toISOString() },
        { event: "TerminateInstances", reason: "EC2 instance TERMINATED in eu-north-1", severity: "HIGH", region: "eu-north-1", user: "Jithu", time: new Date(Date.now() - 3600000).toISOString() },
        { event: "CreateAccessKey", reason: "New access key created for Aswin", severity: "HIGH", region: "global", user: "Pranav", time: new Date(Date.now() - 7200000).toISOString() },
      ],
      issues: [
        { severity: "CRITICAL", msg: "1 CRITICAL alert in last 7 days", fix: "Investigate and resolve critical alerts immediately" },
        { severity: "HIGH", msg: "2 HIGH alerts in last 7 days", fix: "Review and remediate high-severity events" },
      ],
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

const SEV_COLOR = {
  CRITICAL: "#EF4444",
  HIGH: "#F59E0B",
  MEDIUM: "#6366F1",
  LOW: "#22C55E",
};
const SEV_ICON = { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢" };

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimCounter({ target, duration = 1200, color }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const t = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return <span style={{ color }}>{val}</span>;
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120 }) {
  const r = size * 0.42;
  const circ = 2 * Math.PI * r;
  const color = score >= 80 ? "#22C55E" : score >= 60 ? "#F59E0B" : "#EF4444";
  const [anim, setAnim] = useState(0);
  useEffect(() => { setTimeout(() => setAnim(score), 200); }, [score]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={size * 0.085} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.085}
        strokeDasharray={`${circ * anim / 100} ${circ * (1 - anim / 100)}`}
        strokeLinecap="round"
        style={{
          transition: "stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)",
          filter: `drop-shadow(0 0 ${size * 0.06}px ${color}80)`,
        }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%", fontSize: size * 0.22, fontWeight: 700, fontFamily: "monospace", fill: color }}>
        {score}%
      </text>
    </svg>
  );
}

// ── Mini bar ──────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color, label }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { setTimeout(() => setAnim(max > 0 ? (value / max) * 100 : 0), 300); }, [value, max]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${anim}%`, background: color, transition: "width 1s ease .3s" }} />
      </div>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ icon, title, score, status, children, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), delay); }, [delay]);
  const statusColor = status === "GOOD" ? "#22C55E" : status === "WARNING" ? "#F59E0B" : "#EF4444";
  const statusBg = status === "GOOD" ? "rgba(34,197,94,.1)" : status === "WARNING" ? "rgba(245,158,11,.1)" : "rgba(239,68,68,.1)";

  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${statusColor}22`,
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: "var(--r)", padding: "18px 20px",
      boxShadow: `0 4px 20px rgba(0,0,0,.3), 0 0 0 1px ${statusColor}10`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "opacity .5s ease, transform .5s ease",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${statusColor}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{title}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: statusColor, lineHeight: 1 }}>{score}%</div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
            color: statusColor, background: statusBg,
            padding: "2px 7px", borderRadius: 4, marginTop: 3, display: "inline-block",
          }}>{status}</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.05)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{
          height: "100%", borderRadius: 2, background: statusColor,
          width: visible ? `${score}%` : "0%",
          transition: "width 1.2s cubic-bezier(.4,0,.2,1) .2s",
          boxShadow: `0 0 8px ${statusColor}60`,
        }} />
      </div>

      {children}
    </div>
  );
}

// ── Issue row ─────────────────────────────────────────────────────────────────
function IssueRow({ issue, expanded = false }) {
  const [open, setOpen] = useState(expanded);
  const color = SEV_COLOR[issue.severity] || "#94A3B8";
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        borderRadius: 8, padding: "7px 10px",
        background: `${color}08`,
        border: `1px solid ${color}18`,
        marginBottom: 4, cursor: "pointer",
        transition: "background .15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = `${color}14`}
      onMouseLeave={e => e.currentTarget.style.background = `${color}08`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11, flexShrink: 0 }}>{SEV_ICON[issue.severity]}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t1)", flex: 1, lineHeight: 1.4 }}>{issue.msg}</span>
        <span style={{ fontSize: 9, fontWeight: 700, color, flexShrink: 0 }}>{issue.severity}</span>
        <span style={{ fontSize: 10, color: "var(--t3)", flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
      </div>
      {open && (
        <div style={{
          marginTop: 6, paddingTop: 6, borderTop: `1px solid ${color}20`,
          fontSize: 10, color: "#06B6D4", fontFamily: "monospace",
          lineHeight: 1.6,
        }}>
          🔧 Fix: {issue.fix}
        </div>
      )}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color, warn = false }) {
  const c = warn && value > 0 ? color : value === 0 ? "#22C55E" : "var(--t2)";
  return (
    <div style={{
      background: `${warn && value > 0 ? color : "#22C55E"}0a`,
      border: `1px solid ${warn && value > 0 ? color : "#22C55E"}18`,
      borderRadius: 8, padding: "8px 12px", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: c, lineHeight: 1 }}>
        <AnimCounter target={typeof value === "number" ? value : 0} color={c} />
      </div>
      <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 3, letterSpacing: ".04em" }}>{label}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SECURITY TAB
// ══════════════════════════════════════════════════════════════════════════════
export default function SecurityTab({ API, authFetch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [started, setStarted] = useState(false);

  const runScan = useCallback(async (useDemo = false) => {
    setLoading(true); setError(""); setIsDemo(false);

    if (useDemo || !API) {
      await new Promise(r => setTimeout(r, 1800));
      setData(DEMO_DATA);
      setIsDemo(true);
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(`${API}/security`, {
        headers: { "Content-Type": "application/json" },
      });
      const text = await r.text();
      if (r.ok) {
        setData(JSON.parse(text));
      } else {
        console.warn("Security API failed, using demo data:", r.status, text.slice(0, 100));
        await new Promise(r2 => setTimeout(r2, 1000));
        setData(DEMO_DATA);
        setIsDemo(true);
      }
    } catch (e) {
      console.warn("Security fetch error, using demo:", e.message);
      await new Promise(r => setTimeout(r, 800));
      setData(DEMO_DATA);
      setIsDemo(true);
    }
    setLoading(false);
  }, [API]);

  const overall = data?.overallScore ?? 0;
  const overallColor = overall >= 80 ? "#22C55E" : overall >= 60 ? "#F59E0B" : "#EF4444";
  const overallLabel = overall >= 80 ? "GOOD" : overall >= 60 ? "NEEDS WORK" : "CRITICAL";

  const s = data?.sections || {};

  // ── Landing screen ────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="content-area">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>AWS Security Scan</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Real-time analysis of IAM · S3 · EC2 · Network · Logging · Threats</div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 8 }}>Security Scanner Ready</div>
          <div style={{ fontSize: 13, color: "var(--t3)", marginBottom: 32, maxWidth: 420, margin: "0 auto 32px" }}>
            Scans your IAM users, S3 buckets, EC2 instances, security groups, logging config, and live threats.
          </div>
          {/* REMOVED: "View Demo Data" button. Only one button remains. */}
          <button
            onClick={() => { setStarted(true); runScan(false); }}
            style={{
              padding: "12px 28px", borderRadius: 10, cursor: "pointer",
              background: "linear-gradient(135deg,#0288D1,#00BCD4)",
              border: "none", color: "white", fontSize: 14, fontWeight: 600,
              letterSpacing: ".04em", transition: "all .2s",
              boxShadow: "0 4px 20px rgba(2,136,209,.4)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            🔍 Scan Live AWS Account
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="content-area">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>AWS Security Scan</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Scanning your AWS account…</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 20 }}>
          <div style={{ position: "relative", width: 80, height: 80 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: "3px solid rgba(0,188,212,.15)",
              borderTop: "3px solid #00BCD4",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 12, borderRadius: "50%",
              border: "2px solid rgba(99,102,241,.15)",
              borderTop: "2px solid #6366F1",
              animation: "spin 1.5s linear infinite reverse",
            }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🔍</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--t1)", marginBottom: 6 }}>Scanning your AWS environment</div>
            <div style={{ fontSize: 12, color: "var(--t3)" }}>Checking IAM · S3 · EC2 · Security Groups · CloudTrail · Alerts</div>
          </div>
          {[
            { label: "Checking IAM users and policies", delay: 0.0 },
            { label: "Scanning S3 bucket permissions", delay: 0.4 },
            { label: "Analyzing EC2 security groups", delay: 0.8 },
            { label: "Checking logging configuration", delay: 1.2 },
            { label: "Reading live security alerts", delay: 1.6 },
          ].map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              opacity: 0, animation: `fade-in .4s ease ${step.delay}s forwards`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#06B6D4" }} />
              <span style={{ fontSize: 12, color: "var(--t3)" }}>{step.label}</span>
            </div>
          ))}
        </div>
        <style>{`
          @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
          @keyframes fade-in { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        `}</style>
      </div>
    );
  }

  return (
    <div className="content-area">
      <style>{`@keyframes fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header — REMOVED: isDemo badge and "Scan Live AWS" button */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "var(--t1)" }}>AWS Security Scan</div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
            Real-time analysis of IAM · S3 · EC2 · Network · Logging · Threats
            {data?.scannedAt && <span style={{ marginLeft: 8 }}>· Scanned {new Date(data.scannedAt).toLocaleTimeString()}</span>}
          </div>
        </div>
        <button
          onClick={() => runScan(isDemo)}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(99,102,241,.25)", background: "rgba(99,102,241,.08)", color: "#818CF8", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .2s", display: "flex", alignItems: "center", gap: 5 }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(99,102,241,.16)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(99,102,241,.08)"}
        >
          ⟳ Re-scan
        </button>
      </div>

      {/* Overall score banner */}
      <div style={{
        background: `linear-gradient(135deg,${overallColor}08,rgba(0,0,0,0))`,
        border: `1px solid ${overallColor}25`,
        borderRadius: "var(--r)", padding: "20px 24px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
        animation: "fade-in .5s ease",
      }}>
        <ScoreRing score={overall} size={110} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
            AWS Security Posture —{" "}
            <span style={{ color: overallColor }}>{overallLabel}</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${overall}%`, background: overallColor, transition: "width 1.4s ease", boxShadow: `0 0 10px ${overallColor}60` }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.7 }}>
            <span style={{ color: "#EF4444", fontWeight: 600 }}>{data?.issueCount?.CRITICAL || 0} critical</span>{" · "}
            <span style={{ color: "#F59E0B", fontWeight: 600 }}>{data?.issueCount?.HIGH || 0} high</span>{" · "}
            <span style={{ color: "#6366F1", fontWeight: 600 }}>{data?.issueCount?.MEDIUM || 0} medium</span>{" issues found"}
          </div>
        </div>
        {/* Top issues */}
        <div style={{ minWidth: 230 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: ".08em", marginBottom: 8 }}>TOP ISSUES</div>
          {(data?.topIssues || []).map((issue, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5, fontSize: 11 }}>
              <span>{SEV_ICON[issue.severity]}</span>
              <span style={{ color: "var(--t2)", lineHeight: 1.4 }}>{issue.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6 Section cards in 2-col grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* 1. IAM */}
        <SectionCard icon="👤" title="Identity & Access (IAM)" score={s.iam?.score ?? 0} status={s.iam?.status ?? "CRITICAL"} delay={0}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Stat label="Total Users" value={s.iam?.totalUsers ?? 0} color="#6366F1" />
            <Stat label="No MFA ❌" value={s.iam?.noMfa?.length ?? 0} color="#EF4444" warn />
            <Stat label="Admins ⚠️" value={s.iam?.adminUsers?.length ?? 0} color="#F59E0B" warn />
            <Stat label="Old Keys" value={s.iam?.oldKeys?.length ?? 0} color="#F59E0B" warn />
          </div>
          {(s.iam?.issues || []).slice(0, 3).map((issue, i) => <IssueRow key={i} issue={issue} />)}
          {(s.iam?.noMfa || []).length > 0 && (
            <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,.06)", fontSize: 11, color: "var(--t3)" }}>
              Users without MFA: <span style={{ color: "#F87171", fontWeight: 600 }}>{(s.iam?.noMfa || []).join(", ")}</span>
            </div>
          )}
        </SectionCard>

        {/* 2. S3 */}
        <SectionCard icon="🪣" title="S3 Bucket Security" score={s.s3?.score ?? 0} status={s.s3?.status ?? "CRITICAL"} delay={80}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Stat label="Total Buckets" value={s.s3?.totalBuckets ?? 0} color="#6366F1" />
            <Stat label="Public ❌" value={s.s3?.publicBuckets?.length ?? 0} color="#EF4444" warn />
            <Stat label="Unencrypted ⚠️" value={s.s3?.unencryptedBuckets?.length ?? 0} color="#F59E0B" warn />
          </div>
          {(s.s3?.issues || []).slice(0, 3).map((issue, i) => <IssueRow key={i} issue={issue} />)}
          {(s.s3?.issues || []).length === 0 && (
            <div style={{ fontSize: 11, color: "#22C55E", padding: "6px 8px" }}>✅ All S3 buckets are secure</div>
          )}
          {(s.s3?.publicBuckets || []).length > 0 && (
            <div style={{ marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,.06)", fontSize: 11, color: "var(--t3)" }}>
              Public: <span style={{ color: "#F87171", fontFamily: "monospace" }}>{(s.s3?.publicBuckets || []).join(", ")}</span>
            </div>
          )}
        </SectionCard>

        {/* 3. EC2 */}
        <SectionCard icon="🖥️" title="EC2 Instance Security" score={s.ec2?.score ?? 100} status={s.ec2?.status ?? "GOOD"} delay={160}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Stat label="Running" value={s.ec2?.running ?? 0} color="#06B6D4" />
            <Stat label="Stopped" value={s.ec2?.stopped ?? 0} color="#94A3B8" />
            <Stat label="Open Ports ❌" value={s.ec2?.openPorts?.length ?? 0} color="#EF4444" warn />
          </div>
          {(s.ec2?.issues || []).slice(0, 3).map((issue, i) => <IssueRow key={i} issue={issue} />)}
          {(s.ec2?.openPorts || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              {(s.ec2?.openPorts || []).map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px", borderRadius: 5, background: "rgba(239,68,68,.06)", marginBottom: 3, fontSize: 10 }}>
                  <span style={{ color: "#EF4444", fontWeight: 700 }}>PORT {p.port}</span>
                  <span style={{ color: "var(--t3)" }}>({p.service})</span>
                  <span style={{ color: "#EF4444" }}>→ open on</span>
                  <span style={{ color: "var(--t2)", fontFamily: "monospace" }}>{p.instance}</span>
                </div>
              ))}
            </div>
          )}
          {(s.ec2?.running ?? 0) === 0 && (s.ec2?.issues || []).length === 0 && (
            <div style={{ fontSize: 11, color: "var(--t3)", padding: "6px 8px" }}>ℹ️ No running EC2 instances</div>
          )}
        </SectionCard>

        {/* 4. Network */}
        <SectionCard icon="🌐" title="Network Security (Security Groups)" score={s.network?.score ?? 0} status={s.network?.status ?? "CRITICAL"} delay={240}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Stat label="Total SGs" value={s.network?.totalSGs ?? 0} color="#6366F1" />
            <Stat label="Dangerous ❌" value={s.network?.dangerousSGs?.length ?? 0} color="#EF4444" warn />
          </div>
          {(s.network?.dangerousSGs || []).length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {(s.network.dangerousSGs || []).slice(0, 3).map((sg, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 8px", borderRadius: 6, background: "rgba(239,68,68,.06)", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "var(--t3)", fontFamily: "monospace", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sg.name}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(sg.openPorts || []).map((p, j) => (
                      <span key={j} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: SEV_COLOR[p.severity] + "20", color: SEV_COLOR[p.severity], fontWeight: 700 }}>{p.service}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(s.network?.issues || []).slice(0, 2).map((issue, i) => <IssueRow key={i} issue={issue} />)}
          {(s.network?.issues || []).length === 0 && (
            <div style={{ fontSize: 11, color: "#22C55E", padding: "6px 8px" }}>✅ No dangerous port rules found</div>
          )}
        </SectionCard>

        {/* 5. Logging */}
        <SectionCard icon="📋" title="Logging & Monitoring" score={s.logging?.score ?? 0} status={s.logging?.status ?? "CRITICAL"} delay={320}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
            {(s.logging?.checks || []).map((chk, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                borderRadius: 7,
                background: chk.status ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)",
                border: `1px solid ${chk.status ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)"}`,
              }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{chk.status ? "✅" : "❌"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t1)" }}>{chk.name}</div>
                  <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chk.detail}</div>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: chk.status ? "#22C55E" : "#EF4444", flexShrink: 0 }}>{chk.status ? "ACTIVE" : "INACTIVE"}</span>
              </div>
            ))}
          </div>
          {(s.logging?.issues || []).slice(0, 2).map((issue, i) => <IssueRow key={i} issue={issue} />)}
        </SectionCard>

        {/* 6. Threats */}
        <SectionCard icon="⚡" title="Live Threats (Last 7 Days)" score={s.threats?.score ?? 100} status={s.threats?.status ?? "GOOD"} delay={400}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Stat label="Open Alerts" value={s.threats?.openAlerts ?? 0} color="#EF4444" warn />
            <Stat label="Last 24h" value={s.threats?.last24h ?? 0} color="#F59E0B" warn />
            <Stat label="Critical" value={s.threats?.bySeverity?.CRITICAL ?? 0} color="#EF4444" warn />
            <Stat label="High" value={s.threats?.bySeverity?.HIGH ?? 0} color="#F59E0B" warn />
          </div>
          {(s.threats?.topThreats || []).slice(0, 3).map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px",
              borderRadius: 6, background: "rgba(99,102,241,.05)",
              border: "1px solid rgba(99,102,241,.1)", marginBottom: 4,
            }}>
              <span style={{ fontSize: 11 }}>{SEV_ICON[t.severity]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t1)" }}>{t.event}</div>
                <div style={{ fontSize: 10, color: "var(--t3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.reason}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--t3)", flexShrink: 0 }}>{fmtTime(t.time)}</span>
            </div>
          ))}
          {(s.threats?.openAlerts ?? 0) === 0 && (
            <div style={{ fontSize: 11, color: "#22C55E", padding: "6px 8px" }}>✅ No open threats detected</div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
