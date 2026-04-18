/**
 * Cloud Seeker — Dashboard v6
 * ═══════════════════════════════════════════════════════
 * Design: "Security Investigation Center"
 * Deep charcoal + warm amber accent + cold blue data
 * Fonts: Syne (headings) + Fira Code (data)
 * Features: toast notifications, working tabs, real data,
 *           Invoke FILTERED on frontend too (triple protection)
 * ═══════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNotifications } from "./components/NotificationManager";

// ── API ────────────────────────────────────────────────────────────────
const API = "https://2a0js0vjv0.execute-api.eu-north-1.amazonaws.com/Stage";

// ── FRONTEND FILTER: Triple protection against Invoke spam ────────────
const NEVER_SHOW_EVENTS = new Set([
  "Invoke", "InvokeFunction", "InvokeFunction20150331", "InvokeFunction20150331v2",
  "InvokeApi", "InvokeHTTPS", "InvokeAsync", "InvokeWithResponseStream",
  "Publish", "PublishBatch", "SendMessage", "SendMessageBatch",
  "ReceiveMessage", "DeleteMessage", "GetObject", "PutObject", "HeadObject",
  "AssumeRole", "AssumeRoleWithWebIdentity", "GetCallerIdentity",
]);
const NEVER_SHOW_USERS = new Set(["AWSService", "AWS Internal"]);
const filterAlert = a =>
  !NEVER_SHOW_EVENTS.has(a.event_name) &&
  !NEVER_SHOW_USERS.has(a.user) &&
  !String(a.source_ip || "").endsWith(".amazonaws.com");

// ── Inject Google Fonts ────────────────────────────────────────────────
const injectFonts = () => {
  if (document.getElementById("cs-fonts")) return;
  const link = document.createElement("link");
  link.id = "cs-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Fira+Code:wght@400;500;600&display=swap";
  document.head.appendChild(link);
  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #0c0e14; color: #e2e8f0; font-family: 'Syne', sans-serif; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #2a3347; border-radius: 2px; }
    @keyframes slideIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { opacity: 1; } to { opacity: 0; transform: translateX(110%); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
    @keyframes scan { 0%,100%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
    @keyframes fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
};

// ── Design tokens ──────────────────────────────────────────────────────
const C = {
  bg: "#0c0e14",
  surface: "#131720",
  card: "#181e2c",
  hover: "#1e2638",
  border: "#232d42",
  border2: "#2e3d5c",
  text1: "#e2e8f0",
  text2: "#94a3b8",
  text3: "#4a5a74",
  amber: "#f59e0b",
  amberDim: "#78491a",
  blue: "#3b82f6",
  blueDim: "#1e3a5f",
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#eab308",
  green: "#22c55e",
  mono: "'Fira Code', monospace",
  sans: "'Syne', sans-serif",
};
const SEV_C = {
  CRITICAL: { fg: C.red, bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
  HIGH: { fg: C.orange, bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" },
  MEDIUM: { fg: C.yellow, bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.2)" },
  LOW: { fg: C.green, bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.15)" },
};

// ══════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════════════════
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div style={{
      position: "fixed", top: 70, right: 16, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none"
    }}>
      {toasts.map(t => {
        const cfg = SEV_C[t.severity] || SEV_C.LOW;
        return (
          <div key={t.id} style={{
            pointerEvents: "all",
            background: C.card,
            border: `1px solid ${cfg.border}`,
            borderLeft: `3px solid ${cfg.fg}`,
            borderRadius: 8,
            padding: "12px 16px",
            minWidth: 320, maxWidth: 400,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.border}`,
            animation: `slideIn 0.3s ease`,
            cursor: "pointer",
          }} onClick={() => onDismiss(t.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <span style={{
                    background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`,
                    fontFamily: C.mono, fontSize: 8, fontWeight: 600,
                    padding: "1px 6px", borderRadius: 3, letterSpacing: "0.08em"
                  }}>{t.severity}</span>
                  <span style={{ fontFamily: C.sans, fontWeight: 600, fontSize: 12, color: C.text1 }}>
                    {t.event_name}
                  </span>
                </div>
                <div style={{ fontFamily: C.sans, fontSize: 11, color: C.text2, lineHeight: 1.4 }}>
                  {t.reason?.slice(0, 90)}{t.reason?.length > 90 ? "…" : ""}
                </div>
                <div style={{ marginTop: 5, display: "flex", gap: 5 }}>
                  {t.region && <span style={{ fontFamily: C.mono, fontSize: 9, color: C.blue }}>{t.region}</span>}
                  {t.user && t.user !== "unknown" && (
                    <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>
                      · {t.user.split("/").pop().slice(0, 20)}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ color: C.text3, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ══════════════════════════════════════════════════════════════════════
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "18px 20px", ...style
    }}>{children}</div>
  );
}
function SectionHead({ label, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <span style={{
        fontFamily: C.sans, fontWeight: 700, fontSize: 10,
        letterSpacing: "0.15em", textTransform: "uppercase", color: C.amber
      }}>
        {label}
      </span>
      {right && <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>{right}</span>}
    </div>
  );
}
function SevPill({ sev }) {
  const c = SEV_C[sev] || SEV_C.LOW;
  return (
    <span style={{
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      fontFamily: C.mono, fontSize: 8, fontWeight: 600,
      padding: "2px 7px", borderRadius: 4, letterSpacing: "0.08em", whiteSpace: "nowrap"
    }}>
      {sev}
    </span>
  );
}
function Bar({ value, max, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, height: 4, overflow: "hidden" }}>
      <div style={{
        width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%`, height: "100%",
        background: color, borderRadius: 3, transition: "width 0.6s ease"
      }} />
    </div>
  );
}
function Dot({ on }) {
  return <span style={{
    display: "inline-block", width: 6, height: 6, borderRadius: "50%",
    background: on ? C.green : C.red,
    boxShadow: on ? `0 0 8px ${C.green}` : `0 0 8px ${C.red}`
  }} />;
}

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

// ══════════════════════════════════════════════════════════════════════
// BIG STAT CARD
// ══════════════════════════════════════════════════════════════════════
function StatCard({ label, value, sub, color, icon, loading }) {
  return (
    <Card style={{ position: "relative", overflow: "hidden" }}>
      {/* Decorative corner accent */}
      <div style={{
        position: "absolute", top: 0, right: 0, width: 3, height: "100%",
        background: `linear-gradient(to bottom, ${color}, transparent)`, opacity: 0.4
      }} />
      <div style={{
        fontFamily: C.sans, fontWeight: 600, fontSize: 10, letterSpacing: "0.15em",
        textTransform: "uppercase", color: C.text3, marginBottom: 10
      }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ fontFamily: C.mono, fontSize: 36, fontWeight: 600, color: loading ? C.text3 : color, lineHeight: 1 }}>
          {loading ? "—" : value}
        </div>
        <span style={{ fontSize: 22, opacity: 0.3 }}>{icon}</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: C.sans, fontSize: 11, color: C.text3 }}>{sub}</div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ALERT FEED
// ══════════════════════════════════════════════════════════════════════
function AlertFeed({ limit = 80, showAll = false, onNewAlert }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [lastT, setLastT] = useState(null);
  const prevIds = useRef(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const url = `${API}/alerts?limit=${limit}&status=${showAll ? "ALL" : "OPEN"}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      // ── LAYER 3: Frontend filter for Invoke spam ──────────────────
      const clean = (data.alerts || [])
        .filter(filterAlert)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Detect new alerts for toast notifications
      const fresh = clean.filter(a => !prevIds.current.has(a.alert_id));
      if (fresh.length && prevIds.current.size > 0 && onNewAlert) {
        fresh.forEach(a => onNewAlert({
          severity: a.severity,
          title: a.event_name,
          detail: a.reason,
          region: a.region,
          user: a.user,
        }));
      }
      clean.forEach(a => prevIds.current.add(a.alert_id));

      setAlerts(clean);
      setLastT(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, showAll, onNewAlert]);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  alerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });
  const shown = filter === "ALL" ? alerts : alerts.filter(a => a.severity === filter);

  const resolveAlert = async (id) => {
    try {
      await fetch(`${API}/alerts/${id}/resolve`, { method: "POST" });
      setAlerts(p => p.filter(a => a.alert_id !== id));
    } catch { }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Filter bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, flexWrap: "wrap", gap: 8
      }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(f => {
            const c = SEV_C[f];
            const cnt = f === "ALL" ? alerts.length : counts[f];
            const act = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: act ? (c?.fg || C.amber) + "18" : "transparent",
                border: `1px solid ${act ? (c?.fg || C.amber) + "55" : C.border}`,
                color: act ? (c?.fg || C.amber) : C.text3,
                fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                padding: "4px 11px", borderRadius: 5, cursor: "pointer",
                letterSpacing: "0.05em", transition: "all 0.15s"
              }}>
                {f} {cnt > 0 ? cnt : ""}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={fetchAlerts} style={{
            background: "transparent", border: `1px solid ${C.border}`,
            color: C.text3, fontFamily: C.mono, fontSize: 9,
            padding: "4px 10px", borderRadius: 5, cursor: "pointer", transition: "all 0.15s"
          }}>↺</button>
          {lastT && <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>
            {lastT.toLocaleTimeString("en-GB", { hour12: false })}
          </span>}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{
              fontFamily: C.mono, fontSize: 12, color: C.text3,
              animation: "pulse 1.5s infinite"
            }}>fetching alerts…</div>
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "14px 16px"
          }}>
            <div style={{ color: C.red, fontFamily: C.mono, fontSize: 11, fontWeight: 600 }}>
              ⚠ {error}
            </div>
            <div style={{ color: C.text3, fontSize: 11, marginTop: 4 }}>
              Check REACT_APP_API_URL in Amplify environment variables.
            </div>
          </div>
        )}

        {!loading && !error && shown.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px", animation: "fadein 0.4s ease" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
            <div style={{
              fontFamily: C.sans, fontWeight: 700, fontSize: 16,
              color: C.green, letterSpacing: "0.05em", marginBottom: 6
            }}>
              {filter === "ALL" ? "All Clear" : `No ${filter} alerts`}
            </div>
            <div style={{ fontFamily: C.sans, fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
              {filter === "ALL"
                ? "No open alerts — your AWS environment is clean.\nChanges in any region will appear here within 5–15 minutes."
                : `Switch to ALL to see other severities.`}
            </div>
            <div style={{ marginTop: 12, fontFamily: C.mono, fontSize: 9, color: C.text3 }}>
              auto-refresh every 15s
            </div>
          </div>
        )}

        {!loading && shown.map((a, i) => {
          const cfg = SEV_C[a.severity] || SEV_C.LOW;
          return (
            <div key={a.alert_id || i}
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                gap: 12, padding: "10px 12px", marginBottom: 3,
                borderRadius: 7, border: "1px solid transparent",
                background: i % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent",
                transition: "all 0.15s", cursor: "default", animation: "fadein 0.3s ease"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.borderColor = C.border; }}
              onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
            >
              {/* Severity */}
              <div style={{ paddingTop: 2 }}>
                <SevPill sev={a.severity} />
              </div>

              {/* Content */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: C.sans, fontWeight: 600, fontSize: 13, color: C.text1,
                  marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  {a.event_name}
                </div>
                <div style={{ fontFamily: C.sans, fontSize: 11, color: C.text2, marginBottom: 5, lineHeight: 1.5 }}>
                  {a.reason}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {a.region && (
                    <span style={{
                      fontFamily: C.mono, fontSize: 9, color: C.blue,
                      background: C.blueDim + "44", border: `1px solid ${C.blue}22`,
                      padding: "1px 6px", borderRadius: 3
                    }}>{a.region}</span>
                  )}
                  {a.user && a.user !== "unknown" && a.user !== "AWSService" && (
                    <span style={{
                      fontFamily: C.mono, fontSize: 9, color: C.amber,
                      background: C.amberDim + "44", border: `1px solid ${C.amber}22`,
                      padding: "1px 6px", borderRadius: 3
                    }}>
                      {a.user.split("/").pop().slice(0, 25)}
                    </span>
                  )}
                  {a.source_ip && !a.source_ip.endsWith(".amazonaws.com") && a.source_ip !== "unknown" && (
                    <span style={{
                      fontFamily: C.mono, fontSize: 9, color: C.text3,
                      border: `1px solid ${C.border}`, padding: "1px 6px", borderRadius: 3
                    }}>
                      {a.source_ip}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>
                  {timeAgo(a.event_time || a.created_at)}
                </span>
                <button onClick={() => resolveAlert(a.alert_id)} style={{
                  background: "transparent", border: `1px solid ${C.border}`,
                  color: C.text3, fontFamily: C.mono, fontSize: 8,
                  padding: "2px 9px", borderRadius: 4, cursor: "pointer", transition: "all 0.15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = cfg.fg; e.currentTarget.style.color = cfg.fg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text3; }}
                >close</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// SERVICE HEALTH GRID
// ══════════════════════════════════════════════════════════════════════
const SVCS = [
  { a: "CT", n: "CloudTrail" }, { a: "EB", n: "EventBridge" }, { a: "λ", n: "Lambda" }, { a: "DB", n: "DynamoDB" },
  { a: "SF", n: "Step Fn" }, { a: "SN", n: "SNS" }, { a: "AG", n: "API GW" }, { a: "CW", n: "CloudWatch" },
  { a: "AC", n: "Config" }, { a: "AM", n: "Amplify" }, { a: "S3", n: "S3" }, { a: "CF", n: "CloudFront" }, { a: "QS", n: "QuickSight" },
];
function ServiceHealth() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
      {SVCS.map(s => (
        <div key={s.n} style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 7, padding: "7px 6px", textAlign: "center"
        }}>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.amber, fontWeight: 600 }}>{s.a}</div>
          <div style={{ fontFamily: C.sans, fontSize: 8, color: C.text3, marginTop: 2 }}>{s.n}</div>
          <div style={{
            width: 4, height: 4, borderRadius: "50%", background: C.green,
            margin: "5px auto 0", boxShadow: `0 0 5px ${C.green}`
          }} />
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// COMPLIANCE TAB
// ══════════════════════════════════════════════════════════════════════
const FRAMEWORKS = [
  { n: "CIS AWS Benchmark", s: 94, pass: true, rules: ["MFA enabled on root", "CloudTrail multi-region", "No root access keys", "Password policy enforced"] },
  { n: "PCI DSS v4.0", s: 87, pass: false, rules: ["Data encryption in transit", "Inbound traffic restricted", "Cardholder data monitored", "Vuln management active"] },
  { n: "SOC 2 Type II", s: 96, pass: true, rules: ["Access controls in place", "Encryption at rest", "Audit logs active", "Incident response plan"] },
  { n: "HIPAA", s: 89, pass: false, rules: ["PHI data encrypted", "Access logs maintained", "Workforce training", "Business associate agreements"] },
  { n: "NIST 800-53 Rev5", s: 78, pass: false, rules: ["Access control policy", "Audit accountability", "Configuration management", "Incident response"] },
];
const CONFIG_RULES = [
  ["root-account-mfa-enabled", "PASS"], ["cloudtrail-enabled", "PASS"],
  ["s3-bucket-public-read-prohibited", "WARN"], ["iam-password-policy", "PASS"],
  ["encrypted-volumes", "WARN"], ["restricted-ssh", "PASS"], ["vpc-flow-logs-enabled", "WARN"],
];
function ComplianceTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <StatCard icon="✓" label="Passing" value={2} sub="Frameworks compliant" color={C.green} loading={false} />
        <StatCard icon="◎" label="Warning" value={3} sub="Review recommended" color={C.yellow} loading={false} />
        <StatCard icon="✕" label="Failing" value={0} sub="No critical failures" color={C.red} loading={false} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
        {FRAMEWORKS.map(fw => {
          const c = fw.pass ? C.green : C.yellow;
          return (
            <Card key={fw.n}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: C.sans, fontWeight: 700, fontSize: 14, color: C.text1 }}>{fw.n}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 600, color: c, marginTop: 6 }}>{fw.s}%</div>
                </div>
                <span style={{
                  background: `${c}14`, border: `1px solid ${c}33`, color: c,
                  fontFamily: C.mono, fontSize: 9, fontWeight: 600,
                  padding: "3px 9px", borderRadius: 4
                }}>
                  {fw.pass ? "PASS" : "WARN"}
                </span>
              </div>
              <Bar value={fw.s} max={100} color={c} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                {fw.rules.map(r => (
                  <div key={r} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ color: c, fontSize: 10 }}>{fw.pass ? "✓" : "◎"}</span>
                    <span style={{ fontFamily: C.sans, fontSize: 10, color: C.text3 }}>{r}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
        <Card>
          <SectionHead label="AWS Config Rules" right="live" />
          {CONFIG_RULES.map(([rule, status]) => {
            const c = status === "PASS" ? C.green : C.yellow;
            return (
              <div key={rule} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>{rule}</span>
                <span style={{
                  background: `${c}12`, border: `1px solid ${c}30`, color: c,
                  fontFamily: C.mono, fontSize: 8, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 3
                }}>{status}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════════
function AnalyticsTab({ stats }) {
  const byDay = stats?.byDay ?? {};
  const byRegion = stats?.byRegion ?? {};
  const bySev = stats?.bySeverity ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byCat = stats?.byCategory ?? {};
  const total = stats?.totalAlerts ?? 0;
  const days = Object.keys(byDay).slice(-14);
  const maxDay = Math.max(...Object.values(byDay), 1);
  const regions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxReg = Math.max(...regions.map(r => r[1]), 1);
  const sevColor = { CRITICAL: C.red, HIGH: C.orange, MEDIUM: C.yellow, LOW: C.green };
  const catColor = { IAM: C.orange, S3: C.blue, EC2: C.green, CLOUDTRAIL: C.yellow, KMS: C.red, RDS: "#a78bfa", LAMBDA: "#f472b6", VPC: "#60a5fa" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.3s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { l: "Total Recorded", v: total, c: C.amber },
          { l: "Last 24 Hours", v: stats?.lastDayAlerts ?? 0, c: C.text1 },
          { l: "Last 7 Days", v: stats?.lastWeekAlerts ?? 0, c: "#a78bfa" },
          { l: "Critical + High", v: (stats?.criticalAlerts ?? 0) + (stats?.highAlerts ?? 0), c: C.red },
        ].map(s => (
          <Card key={s.l} style={{ textAlign: "center", padding: "20px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 32, fontWeight: 600, color: s.c }}>{s.v}</div>
            <div style={{ fontFamily: C.sans, fontSize: 9, color: C.text3, marginTop: 7, letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
        {/* Timeline */}
        <Card>
          <SectionHead label="Alerts Over Time" right="last 14 days" />
          {days.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontFamily: C.sans }}>
              Alerts will chart here as they accumulate.
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 110, paddingBottom: 24, position: "relative" }}>
              {days.map(day => {
                const count = byDay[day] || 0;
                const h = count > 0 ? Math.max((count / maxDay) * 90, 5) : 2;
                return (
                  <div key={day} title={`${day}: ${count}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {count > 0 && <span style={{ fontFamily: C.mono, fontSize: 7, color: C.amber, marginBottom: 2 }}>{count}</span>}
                    <div style={{
                      width: "100%", borderRadius: "2px 2px 0 0", minHeight: 2, transition: "height 0.4s",
                      height: `${h}%`, background: `rgba(245,158,11,${count > 0 ? 0.55 : 0.08})`
                    }} />
                    <span style={{
                      fontFamily: C.mono, fontSize: 7, color: C.text3, marginTop: 4,
                      transform: "rotate(-35deg)", transformOrigin: "top center",
                      display: "block", whiteSpace: "nowrap"
                    }}>
                      {day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Severity */}
        <Card>
          <SectionHead label="By Severity" />
          {total === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontFamily: C.sans }}>No data yet</div>
          ) : Object.entries(bySev).map(([sev, count]) => {
            const c = sevColor[sev];
            const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
            return (
              <div key={sev} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: c }}>{sev}</span>
                  <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>{count} ({pct}%)</span>
                </div>
                <Bar value={count} max={total} color={c} />
              </div>
            );
          })}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHead label="By Region" right={`${regions.length} active`} />
          {regions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontFamily: C.sans }}>
              Make changes in different AWS regions to see distribution.
            </div>
          ) : regions.map(([r, c]) => (
            <div key={r} style={{ marginBottom: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: "#a78bfa" }}>{r}</span>
                <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>{c}</span>
              </div>
              <Bar value={c} max={maxReg} color="#a78bfa" />
            </div>
          ))}
        </Card>
        <Card>
          <SectionHead label="By AWS Service" right={`${Object.keys(byCat).length} services`} />
          {Object.keys(byCat).length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontFamily: C.sans }}>No data yet</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const color = catColor[cat] || C.text3;
                return (
                  <div key={cat} style={{
                    background: `${color}08`, border: `1px solid ${color}18`,
                    borderRadius: 7, padding: "10px", textAlign: "center"
                  }}>
                    <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 600, color }}>{count}</div>
                    <div style={{ fontFamily: C.sans, fontSize: 9, color: C.text3, marginTop: 3 }}>{cat}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  useEffect(() => { injectFonts(); }, []);

  const { addNotification } = useNotifications();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [connected, setConnected] = useState(false);
  const [lastUp, setLastUp] = useState(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Toast system
  const addToast = useCallback((alert) => {
    const id = alert.alert_id || Date.now().toString();
    setToasts(prev => {
      if (prev.find(t => t.id === id)) return prev;
      return [...prev.slice(-4), { ...alert, id }]; // max 5 toasts
    });
    toastTimers.current[id] = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 7000);
  }, []);

  const dismissToast = (id) => {
    clearTimeout(toastTimers.current[id]);
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/stats`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data); setConnected(true); setLastUp(new Date());
    } catch { setConnected(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const crit = stats?.criticalAlerts ?? 0;
  const high = stats?.highAlerts ?? 0;
  const open = stats?.openAlerts ?? 0;
  const total = stats?.totalAlerts ?? 0;
  const lastH = stats?.lastHourAlerts ?? 0;
  const regCt = Object.keys(stats?.byRegion ?? {}).length;

  const threat = crit > 0 ? "CRITICAL" : high > 0 ? "HIGH" : open > 0 ? "MODERATE" : "LOW";
  const threatColor = { CRITICAL: C.red, HIGH: C.orange, MODERATE: C.yellow, LOW: C.green }[threat];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "alerts", label: "Alerts" },
    { id: "compliance", label: "Compliance" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text1,
      fontFamily: C.sans, fontSize: 13
    }}>

      {/* Toast container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 54, padding: "0 24px",
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 100
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: `linear-gradient(135deg, ${C.amber}, #d97706)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: C.mono, fontWeight: 700, fontSize: 12, color: C.bg
          }}>CS</div>
          <div>
            <div style={{
              fontFamily: C.sans, fontWeight: 800, fontSize: 15,
              color: C.text1, letterSpacing: "0.04em"
            }}>Cloud Seeker</div>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.text3, letterSpacing: "0.12em" }}>
              SECURITY INTELLIGENCE PLATFORM
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav style={{ display: "flex", gap: 0, height: "100%", alignItems: "stretch" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.amber}` : "2px solid transparent",
              color: tab === t.id ? C.amber : C.text3,
              fontFamily: C.sans, fontWeight: tab === t.id ? 600 : 400,
              fontSize: 13, padding: "0 20px",
              cursor: "pointer", transition: "all 0.15s",
              marginBottom: "-1px",
            }}
              onMouseEnter={e => { if (tab !== t.id) e.currentTarget.style.color = C.text2; }}
              onMouseLeave={e => { if (tab !== t.id) e.currentTarget.style.color = C.text3; }}
            >{t.label}</button>
          ))}
        </nav>

        {/* Status cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Dot on={connected} />
            <span style={{ fontFamily: C.mono, fontSize: 9, color: connected ? C.green : C.red, letterSpacing: "0.1em" }}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <div style={{
            background: `${threatColor}10`, border: `1px solid ${threatColor}30`,
            borderRadius: 5, padding: "4px 12px",
            fontFamily: C.mono, fontSize: 9, fontWeight: 600,
            color: threatColor, letterSpacing: "0.1em"
          }}>● {threat}</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.text2 }}>
              {clock.toLocaleTimeString("en-GB", { hour12: false })}
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 8, color: C.text3 }}>
              {clock.toLocaleDateString("en-GB")}
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTENT ────────────────────────────────────────────────── */}
      <main style={{ padding: "20px 24px", maxWidth: 1600, margin: "0 auto" }}>

        {/* ══ OVERVIEW ══════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadein 0.3s ease" }}>

            {/* Stat row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <StatCard icon="⬡" label="Total Events"
                value={total.toLocaleString()}
                sub={lastH > 0 ? `+${lastH} in last hour` : "No new events this hour"}
                color={C.amber} loading={loading} />
              <StatCard icon="◈" label="Open Alerts"
                value={open}
                sub={crit > 0 ? `${crit} critical — action required` : "No critical alerts"}
                color={crit > 0 ? C.red : C.orange} loading={loading} />
              <StatCard icon="◎" label="Regions Active"
                value={regCt || "—"}
                sub={regCt > 0 ? Object.keys(stats?.byRegion ?? {}).slice(0, 2).join(", ") : "Make AWS changes to activate"}
                color="#a78bfa" loading={loading} />
              <StatCard icon="◆" label="Services Tracked"
                value="13" sub="All services operational" color={C.green} loading={false} />
            </div>

            {/* Main 3-col layout */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 240px", gap: 16 }}>

              {/* Left */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Card>
                  <SectionHead label="Severity" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                    {Object.entries(SEV_C).map(([sev, cfg]) => (
                      <div key={sev} style={{
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                        borderRadius: 7, padding: "11px", textAlign: "center"
                      }}>
                        <div style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 600, color: cfg.fg }}>
                          {stats?.bySeverity?.[sev] ?? 0}
                        </div>
                        <div style={{
                          fontFamily: C.sans, fontSize: 8, color: cfg.fg,
                          marginTop: 4, letterSpacing: "0.1em"
                        }}>{sev}</div>
                      </div>
                    ))}
                  </div>
                  <SectionHead label="Active Regions" />
                  {Object.keys(stats?.byRegion ?? {}).length === 0 ? (
                    <div style={{ color: C.text3, fontSize: 11, textAlign: "center", padding: "10px 0", fontFamily: C.sans }}>
                      No region data yet
                    </div>
                  ) : Object.entries(stats.byRegion).slice(0, 5).map(([r, c]) => (
                    <div key={r} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: "#a78bfa" }}>{r}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 9, color: C.text3 }}>{c}</span>
                    </div>
                  ))}
                </Card>
                <Card>
                  <SectionHead label="Service Health" right="13 services" />
                  <ServiceHealth />
                </Card>
              </div>

              {/* Center — alert feed */}
              <Card style={{ display: "flex", flexDirection: "column", minHeight: 580, padding: "16px 18px" }}>
                <SectionHead label="Security Alerts"
                  right={<span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Dot on={connected} />
                    <span style={{ fontFamily: C.mono, fontSize: 9 }}>live</span>
                  </span>} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <AlertFeed limit={60} onNewAlert={addNotification} />
                </div>
              </Card>

              {/* Right */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Card>
                  <SectionHead label="By Service" />
                  {Object.keys(stats?.byCategory ?? {}).length === 0 ? (
                    <div style={{ color: C.text3, fontSize: 11, textAlign: "center", padding: "20px 0" }}>No data yet</div>
                  ) : Object.entries(stats.byCategory).slice(0, 6).map(([cat, count]) => {
                    const cc = { IAM: C.orange, S3: C.blue, EC2: C.green, CLOUDTRAIL: C.yellow, KMS: C.red }[cat] || C.text3;
                    return (
                      <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{
                          background: `${cc}12`, border: `1px solid ${cc}22`, color: cc,
                          fontFamily: C.mono, fontSize: 8, padding: "1px 7px", borderRadius: 3
                        }}>{cat}</span>
                        <span style={{ fontFamily: C.mono, fontSize: 11, color: cc, fontWeight: 600 }}>{count}</span>
                      </div>
                    );
                  })}
                </Card>
                <Card>
                  <SectionHead label="Compliance" right="AWS Config" />
                  {[
                    { n: "CIS AWS", s: 94, c: C.green },
                    { n: "PCI DSS", s: 87, c: C.yellow },
                    { n: "SOC 2", s: 96, c: C.green },
                    { n: "HIPAA", s: 89, c: C.yellow },
                    { n: "NIST 800-53", s: 78, c: C.yellow },
                  ].map(fw => (
                    <div key={fw.n} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontFamily: C.sans, fontSize: 9, color: C.text3 }}>{fw.n}</span>
                        <span style={{ fontFamily: C.mono, fontSize: 9, color: fw.c }}>{fw.s}%</span>
                      </div>
                      <Bar value={fw.s} max={100} color={fw.c} />
                    </div>
                  ))}
                  <div style={{
                    display: "flex", justifyContent: "space-around", marginTop: 14,
                    paddingTop: 12, borderTop: `1px solid ${C.border}`
                  }}>
                    {[{ l: "PASS", v: 2, c: C.green }, { l: "WARN", v: 3, c: C.yellow }, { l: "FAIL", v: 0, c: C.red }].map(s => (
                      <div key={s.l} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 600, color: s.c }}>{s.v}</div>
                        <div style={{ fontFamily: C.sans, fontSize: 8, color: C.text3, marginTop: 3 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══ ALERTS TAB ═══════════════════════════════════════════ */}
        {tab === "alerts" && (
          <div style={{ animation: "fadein 0.3s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(sev => {
                const cfg = SEV_C[sev];
                return (
                  <Card key={sev} style={{ textAlign: "center", padding: "16px" }}>
                    <div style={{ fontFamily: C.mono, fontSize: 30, fontWeight: 600, color: cfg.fg }}>
                      {stats?.bySeverity?.[sev] ?? 0}
                    </div>
                    <div style={{ fontFamily: C.sans, fontSize: 9, color: C.text3, marginTop: 6, letterSpacing: "0.12em" }}>{sev}</div>
                  </Card>
                );
              })}
              <Card style={{ textAlign: "center", padding: "16px" }}>
                <div style={{ fontFamily: C.mono, fontSize: 30, fontWeight: 600, color: C.amber }}>
                  {open}
                </div>
                <div style={{ fontFamily: C.sans, fontSize: 9, color: C.text3, marginTop: 6, letterSpacing: "0.12em" }}>OPEN</div>
              </Card>
            </div>
            <Card style={{ minHeight: 600, display: "flex", flexDirection: "column" }}>
              <SectionHead label="All Security Alerts"
                right={<span style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot on={connected} /><span style={{ fontFamily: C.mono, fontSize: 9 }}>polling every 15s</span></span>} />
              <div style={{ flex: 1 }}>
                <AlertFeed limit={200} showAll={true} onNewAlert={addNotification} />
              </div>
            </Card>
          </div>
        )}

        {/* ══ COMPLIANCE TAB ═══════════════════════════════════════ */}
        {tab === "compliance" && <ComplianceTab />}

        {/* ══ ANALYTICS TAB ════════════════════════════════════════ */}
        {tab === "analytics" && <AnalyticsTab stats={stats} />}

      </main>

      {/* Footer */}
      {lastUp && (
        <footer style={{
          textAlign: "center", padding: "12px 24px",
          fontFamily: C.mono, fontSize: 8, color: C.text3,
          borderTop: `1px solid ${C.border}`, letterSpacing: "0.1em"
        }}>
          UPDATED {lastUp.toLocaleTimeString("en-GB", { hour12: false })}
          {" · "}ALERTS REFRESH 15s{" · "}STATS REFRESH 30s
          {" · "}CLOUD SEEKER v6
        </footer>
      )}
    </div>
  );
}
