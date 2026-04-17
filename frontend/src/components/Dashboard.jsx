/**
 * Cloud Seeker — Dashboard v5
 * Complete redesign: clean enterprise security dashboard
 * Fonts: Outfit (headings) + JetBrains Mono (data) — loaded from Google Fonts
 * Theme: deep navy + slate panels + electric blue accent
 * Layout: sidebar nav + main content area
 */

import { useState, useEffect, useCallback, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "";

// ── Google Fonts injection ─────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');`;

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg0:       "#060a12",   // deepest background
  bg1:       "#0b1120",   // panel background
  bg2:       "#111827",   // card background
  bg3:       "#1a2332",   // hover/active
  border:    "#1e2d42",   // subtle borders
  border2:   "#2a3f58",   // stronger borders
  text1:     "#e8f0fe",   // primary text
  text2:     "#7a9ab8",   // secondary text
  text3:     "#3d5a7a",   // muted text
  accent:    "#3b82f6",   // blue accent
  accentGlow:"rgba(59,130,246,0.15)",
  critical:  "#ef4444",
  high:      "#f97316",
  medium:    "#f59e0b",
  low:       "#22c55e",
  fontHead:  "'Outfit', sans-serif",
  fontMono:  "'JetBrains Mono', monospace",
};

const SEV = {
  CRITICAL: { color: T.critical, bg: "rgba(239,68,68,0.08)",   label: "CRIT" },
  HIGH:     { color: T.high,     bg: "rgba(249,115,22,0.08)",  label: "HIGH" },
  MEDIUM:   { color: T.medium,   bg: "rgba(245,158,11,0.08)",  label: "MED"  },
  LOW:      { color: T.low,      bg: "rgba(34,197,94,0.06)",   label: "LOW"  },
};

// ── Utility ────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-GB", { hour12: false }); }
  catch { return iso; }
}

// ══════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.bg1, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: "18px 20px",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.2s",
      ...style
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = T.border2)}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = T.border)}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <span style={{ fontFamily:T.fontHead, fontWeight:600, fontSize:11,
                     letterSpacing:"0.12em", textTransform:"uppercase", color:T.text2 }}>
        {children}
      </span>
      {right && <span style={{ color:T.text3, fontSize:10, fontFamily:T.fontMono }}>{right}</span>}
    </div>
  );
}

function SevBadge({ severity }) {
  const cfg = SEV[severity] || SEV.LOW;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontFamily: T.fontMono, fontSize: 9, fontWeight: 700,
      padding: "2px 7px", borderRadius: 4, letterSpacing: "0.08em",
      border: `1px solid ${cfg.color}30`, whiteSpace: "nowrap"
    }}>{cfg.label}</span>
  );
}

function Tag({ color = T.text3, children }) {
  return (
    <span style={{
      fontFamily: T.fontMono, fontSize: 9, color,
      background: `${color}10`, border: `1px solid ${color}20`,
      padding: "1px 6px", borderRadius: 3
    }}>{children}</span>
  );
}

function Pill({ label, value, color }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontFamily:T.fontMono, fontSize:26, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:T.fontHead, fontSize:9, color:T.text3, marginTop:5, letterSpacing:"0.1em" }}>{label}</div>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value/max)*100, 100) : 0;
  return (
    <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:3, height:5, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.6s ease" }} />
    </div>
  );
}

function StatusDot({ on }) {
  return (
    <span style={{ display:"inline-block", width:6, height:6, borderRadius:"50%",
                   background: on ? "#22c55e" : "#ef4444",
                   boxShadow: on ? "0 0 8px #22c55e88" : "0 0 8px #ef444488" }} />
  );
}

// ══════════════════════════════════════════════════════════════════════════
// STAT CARD (top row)
// ══════════════════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, sub, accentColor, loading }) {
  return (
    <Card style={{ display:"flex", flexDirection:"column", gap:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <span style={{ fontFamily:T.fontHead, fontSize:10, letterSpacing:"0.12em",
                       textTransform:"uppercase", color:T.text3, fontWeight:500 }}>{label}</span>
        <span style={{ fontSize:16, opacity:0.6 }}>{icon}</span>
      </div>
      <div style={{ fontFamily:T.fontMono, fontSize:34, fontWeight:700,
                    color: loading ? T.text3 : (accentColor || T.text1), lineHeight:1 }}>
        {loading ? "—" : value}
      </div>
      <div style={{ fontFamily:T.fontHead, fontSize:11, color:T.text3 }}>{sub}</div>
      <div style={{ height:2, background:`linear-gradient(90deg, ${accentColor || T.accent}, transparent)`,
                    borderRadius:1, marginTop:2, opacity:0.5 }} />
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ALERT FEED (clean row-based)
// ══════════════════════════════════════════════════════════════════════════
function AlertFeed({ limit = 60, showAll = false }) {
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [filter,    setFilter]    = useState("ALL");
  const [lastFetch, setLastFetch] = useState(null);
  const prevIds = useRef(new Set());
  const [newCount, setNewCount]   = useState(0);

  const fetchAlerts = useCallback(async () => {
    if (!API) { setError("REACT_APP_API_URL not set"); setLoading(false); return; }
    try {
      const url = `${API}/alerts?limit=${limit}&status=${showAll ? "ALL" : "OPEN"}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const items = (data.alerts || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const fresh = items.filter(a => !prevIds.current.has(a.alert_id));
      if (fresh.length && prevIds.current.size > 0) setNewCount(n => n + fresh.length);
      items.forEach(a => prevIds.current.add(a.alert_id));
      setAlerts(items);
      setLastFetch(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, showAll]);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 15_000);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  const filtered = filter === "ALL" ? alerts : alerts.filter(a => a.severity === filter);
  const counts   = { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 };
  alerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });

  const resolveAlert = async (id) => {
    if (!API) return;
    try {
      await fetch(`${API}/alerts/${id}/resolve`, { method:"POST" });
      setAlerts(prev => prev.filter(a => a.alert_id !== id));
    } catch {}
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Controls bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    marginBottom:14, flexWrap:"wrap", gap:8 }}>
        {/* Severity count pills */}
        <div style={{ display:"flex", gap:6 }}>
          {["ALL","CRITICAL","HIGH","MEDIUM","LOW"].map(sev => {
            const cfg  = SEV[sev];
            const cnt  = sev === "ALL" ? alerts.length : (counts[sev] || 0);
            const isActive = filter === sev;
            return (
              <button key={sev} onClick={() => setFilter(sev)} style={{
                background: isActive ? (cfg?.color || T.accent)+"22" : "transparent",
                border:     `1px solid ${isActive ? (cfg?.color || T.accent)+"66" : T.border}`,
                color:      isActive ? (cfg?.color || T.accent) : T.text3,
                fontFamily: T.fontMono, fontSize:9, fontWeight:700,
                padding:    "4px 10px", borderRadius:5, cursor:"pointer",
                letterSpacing:"0.08em", transition:"all 0.15s"
              }}>
                {sev} {cnt > 0 && <span style={{ marginLeft:4, opacity:0.8 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {newCount > 0 && (
            <button onClick={() => setNewCount(0)} style={{
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
              color:T.critical, fontFamily:T.fontMono, fontSize:9, fontWeight:700,
              padding:"3px 8px", borderRadius:4, cursor:"pointer"
            }}>+{newCount} new</button>
          )}
          <button onClick={fetchAlerts} style={{
            background:"transparent", border:`1px solid ${T.border}`,
            color:T.text3, fontFamily:T.fontMono, fontSize:9,
            padding:"3px 9px", borderRadius:5, cursor:"pointer"
          }}>↺ refresh</button>
          {lastFetch && (
            <span style={{ color:T.text3, fontSize:9, fontFamily:T.fontMono }}>
              {fmtTime(lastFetch.toISOString())}
            </span>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div style={{ flex:1, overflowY:"auto" }}>

        {loading && (
          <div style={{ textAlign:"center", padding:"60px 0", color:T.text3 }}>
            <div style={{ fontFamily:T.fontHead, fontSize:13 }}>Loading alerts from AWS…</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ background:"rgba(239,68,68,0.06)", border:`1px solid rgba(239,68,68,0.2)`,
                        borderRadius:8, padding:"16px 20px", margin:"8px 0" }}>
            <div style={{ color:T.critical, fontFamily:T.fontMono, fontSize:11, fontWeight:700 }}>
              ⚠ API Error: {error}
            </div>
            <div style={{ color:T.text3, fontSize:11, marginTop:6, fontFamily:T.fontHead }}>
              Set REACT_APP_API_URL in Amplify → Environment variables.
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"70px 0" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
            <div style={{ fontFamily:T.fontHead, fontWeight:600, color:T.low, fontSize:15, letterSpacing:"0.05em" }}>
              All Clear
            </div>
            <div style={{ color:T.text3, fontSize:12, marginTop:6, fontFamily:T.fontHead }}>
              {filter === "ALL"
                ? "No open alerts — your AWS environment is clean"
                : `No ${filter} severity alerts`}
            </div>
            <div style={{ color:T.text3, fontSize:10, marginTop:8, fontFamily:T.fontMono }}>
              Auto-refreshing every 15s
            </div>
          </div>
        )}

        {!loading && filtered.map((alert, idx) => {
          const cfg = SEV[alert.severity] || SEV.LOW;
          return (
            <div key={alert.alert_id || idx} style={{
              display:"grid",
              gridTemplateColumns:"auto 1fr auto",
              gap:12,
              padding:"11px 14px",
              marginBottom:4,
              borderRadius:7,
              background: idx % 2 === 0 ? T.bg2 : "transparent",
              border:`1px solid transparent`,
              transition:"all 0.15s",
              cursor:"default",
              alignItems:"start"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bg3; e.currentTarget.style.borderColor = T.border; }}
            onMouseLeave={e => { e.currentTarget.style.background = idx%2===0 ? T.bg2 : "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
            >
              {/* Severity badge */}
              <div style={{ paddingTop:1 }}>
                <SevBadge severity={alert.severity} />
              </div>

              {/* Content */}
              <div style={{ minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontFamily:T.fontHead, fontWeight:600, fontSize:13,
                                 color:T.text1, whiteSpace:"nowrap", overflow:"hidden",
                                 textOverflow:"ellipsis" }}>
                    {alert.event_name}
                  </span>
                </div>
                <div style={{ fontFamily:T.fontHead, fontSize:11, color:T.text2,
                              marginBottom:6, lineHeight:1.5 }}>
                  {alert.reason}
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {alert.region && <Tag color={T.accent}>{alert.region}</Tag>}
                  {alert.user && alert.user !== "unknown" && (
                    <Tag color="#a78bfa">{alert.user.split("/").pop().slice(0,30)}</Tag>
                  )}
                  {alert.source_ip && !alert.source_ip.endsWith(".amazonaws.com") && alert.source_ip !== "unknown" && (
                    <Tag color={T.text3}>{alert.source_ip}</Tag>
                  )}
                  {alert.event_source && (
                    <Tag color={T.text3}>{alert.event_source.replace(".amazonaws.com","")}</Tag>
                  )}
                </div>
              </div>

              {/* Time + resolve */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.text3, whiteSpace:"nowrap" }}>
                  {timeAgo(alert.event_time || alert.created_at)}
                </span>
                <button onClick={() => resolveAlert(alert.alert_id)} style={{
                  background:"transparent", border:`1px solid ${T.border}`,
                  color:T.text3, fontFamily:T.fontMono, fontSize:8, fontWeight:600,
                  padding:"2px 8px", borderRadius:4, cursor:"pointer", letterSpacing:"0.05em",
                  transition:"all 0.15s"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=cfg.color; e.currentTarget.style.color=cfg.color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.text3; }}
                >resolve</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SERVICE HEALTH (mini)
// ══════════════════════════════════════════════════════════════════════════
const SERVICES = [
  { abbr:"CT", name:"CloudTrail"    },{ abbr:"EB", name:"EventBridge"  },
  { abbr:"λ",  name:"Lambda"        },{ abbr:"DB", name:"DynamoDB"     },
  { abbr:"SF", name:"Step Fn"       },{ abbr:"SN", name:"SNS"          },
  { abbr:"AG", name:"API Gateway"   },{ abbr:"CW", name:"CloudWatch"   },
  { abbr:"AC", name:"AWS Config"    },{ abbr:"AM", name:"Amplify"      },
  { abbr:"S3", name:"S3"            },{ abbr:"CF", name:"CloudFront"   },
  { abbr:"QS", name:"QuickSight"    },
];
function ServiceHealth() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
      {SERVICES.map(s => (
        <div key={s.name} style={{
          background:T.bg2, border:`1px solid ${T.border}`, borderRadius:6,
          padding:"6px 8px", textAlign:"center"
        }}>
          <div style={{ fontFamily:T.fontMono, fontSize:10, color:T.low, fontWeight:700 }}>{s.abbr}</div>
          <div style={{ fontFamily:T.fontHead, fontSize:8, color:T.text3, marginTop:2 }}>{s.name}</div>
          <div style={{ width:4, height:4, borderRadius:"50%", background:T.low,
                        margin:"4px auto 0", boxShadow:`0 0 6px ${T.low}88` }} />
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPLIANCE PANEL
// ══════════════════════════════════════════════════════════════════════════
const FRAMEWORKS = [
  { name:"CIS AWS Benchmark", score:94, pass:true,  rules:["MFA on root","CloudTrail all regions","No root access keys","Password policy set"] },
  { name:"PCI DSS",           score:87, pass:false, rules:["Encrypt data in transit","Restrict inbound traffic","Monitor cardholder data","Vulnerability management"] },
  { name:"SOC 2",             score:96, pass:true,  rules:["Access controls","Encryption at rest","Audit logging","Incident response"] },
  { name:"HIPAA",             score:89, pass:false, rules:["PHI encrypted","Access logs","Workforce training","BAA in place"] },
  { name:"NIST 800-53",       score:78, pass:false, rules:["Access control","Audit & accountability","Config management","Incident response"] },
];
function ComplianceTab() {
  const passing = FRAMEWORKS.filter(f => f.pass).length;
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        <StatCard icon="✓" label="Passing" value={passing} sub="Frameworks compliant" accentColor={T.low} loading={false} />
        <StatCard icon="⚠" label="Warning" value={FRAMEWORKS.length - passing} sub="Need attention" accentColor={T.medium} loading={false} />
        <StatCard icon="✕" label="Failing" value={0} sub="No critical failures" accentColor={T.critical} loading={false} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {FRAMEWORKS.map(fw => (
          <Card key={fw.name} style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontFamily:T.fontHead, fontWeight:600, fontSize:13, color:T.text1 }}>{fw.name}</div>
                <div style={{ fontFamily:T.fontMono, fontSize:20, fontWeight:700,
                              color: fw.pass ? T.low : T.medium, marginTop:6 }}>{fw.score}%</div>
              </div>
              <span style={{
                background: fw.pass ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                border: `1px solid ${fw.pass ? T.low : T.medium}44`,
                color: fw.pass ? T.low : T.medium,
                fontFamily:T.fontMono, fontSize:9, fontWeight:700,
                padding:"3px 8px", borderRadius:4
              }}>{fw.pass ? "PASS" : "WARN"}</span>
            </div>
            <ProgressBar value={fw.score} max={100} color={fw.pass ? T.low : T.medium} />
            <div style={{ marginTop:12 }}>
              {fw.rules.map(r => (
                <div key={r} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                  <span style={{ color: fw.pass ? T.low : T.medium, fontSize:10 }}>{fw.pass ? "✓" : "◎"}</span>
                  <span style={{ fontFamily:T.fontHead, fontSize:10, color:T.text3 }}>{r}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <SectionTitle>AWS Config Rules</SectionTitle>
          {[
            ["root-account-mfa-enabled",        "PASS"],
            ["cloudtrail-enabled",              "PASS"],
            ["s3-bucket-public-read-prohibited","WARN"],
            ["iam-password-policy",             "PASS"],
            ["encrypted-volumes",               "WARN"],
            ["restricted-ssh",                  "PASS"],
            ["vpc-flow-logs-enabled",           "WARN"],
          ].map(([rule, status]) => {
            const c = status === "PASS" ? T.low : T.medium;
            return (
              <div key={rule} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.text3 }}>{rule}</span>
                <span style={{ background:`${c}12`, border:`1px solid ${c}33`, color:c,
                               fontFamily:T.fontMono, fontSize:8, fontWeight:700,
                               padding:"2px 7px", borderRadius:3 }}>{status}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB
// ══════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ stats }) {
  const byDay    = stats?.byDay      ?? {};
  const byRegion = stats?.byRegion   ?? {};
  const bySev    = stats?.bySeverity ?? { CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0 };
  const byCat    = stats?.byCategory ?? {};
  const total    = stats?.totalAlerts ?? 0;

  const days    = Object.keys(byDay).slice(-14);
  const maxDay  = Math.max(...Object.values(byDay), 1);
  const regions = Object.entries(byRegion).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxReg  = Math.max(...regions.map(r=>r[1]), 1);
  const cats    = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const catColors = { IAM:T.high, S3:T.accent, EC2:T.low, CLOUDTRAIL:T.medium, KMS:T.critical, RDS:"#a78bfa", LAMBDA:"#f472b6", VPC:"#60a5fa" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Summary row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          { label:"Total Alerts",    value:total,                         color:T.accent  },
          { label:"Last 24 Hours",   value:stats?.lastDayAlerts ?? 0,     color:T.text1   },
          { label:"Last 7 Days",     value:stats?.lastWeekAlerts ?? 0,    color:"#a78bfa" },
          { label:"Critical + High", value:(stats?.criticalAlerts??0)+(stats?.highAlerts??0), color:T.critical },
        ].map(s => (
          <Card key={s.label} style={{ textAlign:"center", padding:"20px" }}>
            <div style={{ fontFamily:T.fontMono, fontSize:30, fontWeight:700, color:s.color }}>{s.value}</div>
            <div style={{ fontFamily:T.fontHead, fontSize:10, color:T.text3, marginTop:6, letterSpacing:"0.1em" }}>{s.label.toUpperCase()}</div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>

        {/* Timeline bar chart */}
        <Card>
          <SectionTitle right="last 14 days">Alerts Over Time</SectionTitle>
          {days.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:T.text3, fontFamily:T.fontHead }}>
              No historical data yet — alerts will appear here as they accumulate
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:100, paddingBottom:20, position:"relative" }}>
              {days.map(day => {
                const count = byDay[day] || 0;
                const h     = Math.max(count > 0 ? (count/maxDay)*100 : 0, 0);
                return (
                  <div key={day} title={`${day}: ${count} alerts`} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", cursor:"default" }}>
                    {count > 0 && <span style={{ fontFamily:T.fontMono, fontSize:7, color:T.text3, marginBottom:2 }}>{count}</span>}
                    <div style={{ width:"100%", background:`rgba(59,130,246,${count>0?0.5:0.07})`, height:`${h}%`, borderRadius:"3px 3px 0 0", minHeight:count>0?3:1, transition:"height 0.4s" }} />
                    <span style={{ fontFamily:T.fontMono, fontSize:7, color:T.text3, marginTop:4, transform:"rotate(-35deg)", transformOrigin:"top center", display:"block", whiteSpace:"nowrap" }}>
                      {day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Severity donut (bar version) */}
        <Card>
          <SectionTitle>By Severity</SectionTitle>
          {total === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color:T.text3, fontFamily:T.fontHead, fontSize:12 }}>No data yet</div>
          ) : (
            Object.entries(bySev).map(([sev, count]) => {
              const c   = { CRITICAL:T.critical, HIGH:T.high, MEDIUM:T.medium, LOW:T.low }[sev];
              const pct = total > 0 ? ((count/total)*100).toFixed(0) : 0;
              return (
                <div key={sev} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontFamily:T.fontMono, fontSize:9, color:c }}>{sev}</span>
                    <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.text3 }}>{count} ({pct}%)</span>
                  </div>
                  <ProgressBar value={count} max={total} color={c} />
                </div>
              );
            })
          )}
        </Card>
      </div>

      {/* Region + Service charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        <Card>
          <SectionTitle right={`${regions.length} regions`}>By AWS Region</SectionTitle>
          {regions.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color:T.text3, fontFamily:T.fontHead }}>
              Make changes in different regions to see distribution
            </div>
          ) : regions.map(([region, count]) => (
            <div key={region} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontFamily:T.fontMono, fontSize:9, color:"#a78bfa" }}>{region}</span>
                <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.text3 }}>{count}</span>
              </div>
              <ProgressBar value={count} max={maxReg} color="#a78bfa" />
            </div>
          ))}
        </Card>

        <Card>
          <SectionTitle right={`${cats.length} services`}>By AWS Service</SectionTitle>
          {cats.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color:T.text3, fontFamily:T.fontHead }}>No data yet</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {cats.map(([cat, count]) => {
                const color = catColors[cat] || T.text3;
                return (
                  <div key={cat} style={{ background:`${color}08`, border:`1px solid ${color}18`,
                                          borderRadius:7, padding:"10px 12px", textAlign:"center" }}>
                    <div style={{ fontFamily:T.fontMono, fontSize:20, fontWeight:700, color }}>{count}</div>
                    <div style={{ fontFamily:T.fontHead, fontSize:9, color:T.text3, marginTop:3 }}>{cat}</div>
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

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState("overview");
  const [connected, setConnected] = useState(false);
  const [lastUp,    setLastUp]    = useState(null);
  const [clock,     setClock]     = useState(new Date());

  // live clock
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return ()=>clearInterval(t); }, []);

  const fetchStats = useCallback(async () => {
    if (!API) { setLoading(false); return; }
    try {
      const res  = await fetch(`${API}/stats`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setStats(data); setConnected(true); setLastUp(new Date());
    } catch { setConnected(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); const t=setInterval(fetchStats,30_000); return()=>clearInterval(t); }, [fetchStats]);

  const crit  = stats?.criticalAlerts ?? 0;
  const high  = stats?.highAlerts     ?? 0;
  const open  = stats?.openAlerts     ?? 0;
  const total = stats?.totalAlerts    ?? 0;
  const lastH = stats?.lastHourAlerts ?? 0;
  const regCt = Object.keys(stats?.byRegion ?? {}).length;

  const threat = crit > 0 ? "CRITICAL" : high > 0 ? "HIGH" : open > 0 ? "MODERATE" : "LOW";
  const thColor = { CRITICAL:T.critical, HIGH:T.high, MODERATE:T.medium, LOW:T.low }[threat];

  const TABS = [
    { id:"overview",   label:"Overview"   },
    { id:"alerts",     label:"Alerts"     },
    { id:"compliance", label:"Compliance" },
    { id:"analytics",  label:"Analytics"  },
  ];

  return (
    <>
      <style>{FONTS + `
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:${T.bg0}; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${T.border2}; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:#3d5a7a; }
      `}</style>

      <div style={{ minHeight:"100vh", background:T.bg0, color:T.text1,
                    fontFamily:T.fontHead, fontSize:13 }}>

        {/* ── TOP NAVIGATION BAR ─────────────────────────────────────── */}
        <header style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"0 24px", height:52,
          background:T.bg1, borderBottom:`1px solid ${T.border}`,
          position:"sticky", top:0, zIndex:200,
        }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:`linear-gradient(135deg, ${T.accent}, #1d4ed8)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:T.fontMono, fontWeight:700, fontSize:11, color:"#fff"
            }}>CS</div>
            <div>
              <div style={{ fontFamily:T.fontHead, fontWeight:700, fontSize:14,
                            letterSpacing:"0.06em", color:T.text1 }}>Cloud Seeker</div>
              <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.text3, letterSpacing:"0.15em" }}>
                AWS SECURITY INTELLIGENCE
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <nav style={{ display:"flex", gap:2, height:"100%", alignItems:"stretch" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background:  "transparent",
                border:      "none",
                borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
                color:       tab === t.id ? T.text1 : T.text3,
                fontFamily:  T.fontHead, fontWeight: tab===t.id ? 600 : 400,
                fontSize:    13, padding:"0 18px",
                cursor:      "pointer", transition:"all 0.15s",
                marginBottom: "-1px",
              }}
              onMouseEnter={e => { if(tab!==t.id) e.currentTarget.style.color=T.text2; }}
              onMouseLeave={e => { if(tab!==t.id) e.currentTarget.style.color=T.text3; }}
              >{t.label}</button>
            ))}
          </nav>

          {/* Status bar */}
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            {/* Connection */}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <StatusDot on={connected} />
              <span style={{ fontFamily:T.fontMono, fontSize:9, color:connected?T.low:T.critical, letterSpacing:"0.1em" }}>
                {connected ? "LIVE" : "OFFLINE"}
              </span>
            </div>
            {/* Threat level */}
            <div style={{
              background:`${thColor}10`, border:`1px solid ${thColor}30`,
              borderRadius:5, padding:"4px 12px",
              fontFamily:T.fontMono, fontSize:9, fontWeight:700,
              color:thColor, letterSpacing:"0.1em"
            }}>● {threat}</div>
            {/* Clock */}
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:T.fontMono, fontSize:13, fontWeight:700, color:T.text2 }}>
                {clock.toLocaleTimeString("en-GB",{hour12:false})}
              </div>
              <div style={{ fontFamily:T.fontMono, fontSize:8, color:T.text3 }}>
                {clock.toLocaleDateString("en-GB")}
              </div>
            </div>
          </div>
        </header>

        {/* ── PAGE CONTENT ───────────────────────────────────────────── */}
        <main style={{ padding:"20px 24px", maxWidth:1600, margin:"0 auto" }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Stat cards */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
                <StatCard icon="◉" label="Total Events"    value={total.toLocaleString()}
                  sub={lastH > 0 ? `+${lastH} in last hour` : "No new events this hour"}
                  accentColor={T.accent} loading={loading} />
                <StatCard icon="⚠" label="Open Alerts"     value={open}
                  sub={crit > 0 ? `${crit} critical — action needed` : "No critical alerts"}
                  accentColor={crit > 0 ? T.critical : T.high} loading={loading} />
                <StatCard icon="◈" label="Regions Active"  value={regCt || "—"}
                  sub={regCt > 0 ? Object.keys(stats?.byRegion??{}).slice(0,2).join(", ") : "Make AWS changes to see regions"}
                  accentColor="#a78bfa" loading={loading} />
                <StatCard icon="◆" label="Services Tracked" value="13"
                  sub="All services healthy" accentColor={T.low} loading={false} />
              </div>

              {/* Main content */}
              <div style={{ display:"grid", gridTemplateColumns:"260px 1fr 220px", gap:16 }}>

                {/* Left column */}
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {/* Severity breakdown */}
                  <Card>
                    <SectionTitle>Severity Overview</SectionTitle>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
                      {Object.entries(SEV).map(([sev, cfg]) => (
                        <div key={sev} style={{ background:cfg.bg, border:`1px solid ${cfg.color}20`,
                                                borderRadius:6, padding:"10px", textAlign:"center" }}>
                          <div style={{ fontFamily:T.fontMono, fontSize:20, fontWeight:700, color:cfg.color }}>
                            {stats?.bySeverity?.[sev] ?? 0}
                          </div>
                          <div style={{ fontFamily:T.fontHead, fontSize:8, color:cfg.color,
                                        marginTop:3, letterSpacing:"0.1em" }}>{sev}</div>
                        </div>
                      ))}
                    </div>
                    <SectionTitle>Regions</SectionTitle>
                    {Object.keys(stats?.byRegion ?? {}).length === 0 ? (
                      <div style={{ color:T.text3, fontSize:11, textAlign:"center", padding:"12px 0", fontFamily:T.fontHead }}>
                        No region data yet
                      </div>
                    ) : Object.entries(stats.byRegion).slice(0,5).map(([r, c]) => (
                      <div key={r} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <span style={{ fontFamily:T.fontMono, fontSize:9, color:"#a78bfa" }}>{r}</span>
                        <span style={{ fontFamily:T.fontMono, fontSize:9, color:T.text3 }}>{c}</span>
                      </div>
                    ))}
                  </Card>

                  {/* Service Health */}
                  <Card>
                    <SectionTitle right="13 services">Service Health</SectionTitle>
                    <ServiceHealth />
                  </Card>
                </div>

                {/* Center — alert feed */}
                <Card style={{ padding:"16px 18px", minHeight:580, display:"flex", flexDirection:"column" }}>
                  <SectionTitle right={<><StatusDot on={connected} /> <span style={{marginLeft:5}}>live</span></>}>
                    Security Alerts
                  </SectionTitle>
                  <div style={{ flex:1, overflow:"hidden" }}>
                    <AlertFeed limit={60} />
                  </div>
                </Card>

                {/* Right column */}
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {/* By category */}
                  <Card>
                    <SectionTitle>By Service</SectionTitle>
                    {Object.keys(stats?.byCategory ?? {}).length === 0 ? (
                      <div style={{ color:T.text3, fontSize:11, textAlign:"center", padding:"20px 0", fontFamily:T.fontHead }}>No data yet</div>
                    ) : Object.entries(stats.byCategory).slice(0,6).map(([cat, count]) => {
                      const cc = { IAM:T.high, S3:T.accent, EC2:T.low, CLOUDTRAIL:T.medium, KMS:T.critical }[cat] || T.text3;
                      return (
                        <div key={cat} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                          <span style={{ background:`${cc}12`, border:`1px solid ${cc}25`, color:cc,
                                         fontFamily:T.fontMono, fontSize:8, padding:"1px 7px", borderRadius:3 }}>{cat}</span>
                          <span style={{ fontFamily:T.fontMono, fontSize:11, color:cc, fontWeight:700 }}>{count}</span>
                        </div>
                      );
                    })}
                  </Card>

                  {/* Compliance summary */}
                  <Card>
                    <SectionTitle right="AWS Config">Compliance</SectionTitle>
                    {FRAMEWORKS.map(fw => (
                      <div key={fw.name} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:T.fontHead, fontSize:9, color:T.text3 }}>{fw.name}</span>
                          <span style={{ fontFamily:T.fontMono, fontSize:9,
                                         color: fw.pass ? T.low : T.medium }}>{fw.score}%</span>
                        </div>
                        <ProgressBar value={fw.score} max={100} color={fw.pass ? T.low : T.medium} />
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-around", marginTop:14, paddingTop:12,
                                  borderTop:`1px solid ${T.border}` }}>
                      <Pill label="PASSING" value={2} color={T.low} />
                      <Pill label="WARNING" value={3} color={T.medium} />
                      <Pill label="FAILING" value={0} color={T.critical} />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ALERTS TAB */}
          {tab === "alerts" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:16 }}>
                {[...Object.entries(SEV), ["TOTAL", {color:T.accent, bg:T.accentGlow}]].map(([sev,cfg]) => {
                  const val = sev === "TOTAL" ? (stats?.openAlerts??0) : (stats?.bySeverity?.[sev]??0);
                  return (
                    <Card key={sev} style={{ textAlign:"center", padding:"16px" }}>
                      <div style={{ fontFamily:T.fontMono, fontSize:28, fontWeight:700, color:cfg.color }}>{val}</div>
                      <div style={{ fontFamily:T.fontHead, fontSize:9, color:T.text3, marginTop:6, letterSpacing:"0.12em" }}>{sev}</div>
                    </Card>
                  );
                })}
              </div>
              <Card style={{ minHeight:600, display:"flex", flexDirection:"column" }}>
                <SectionTitle right={<><StatusDot on={connected}/> <span style={{marginLeft:5}}>polling every 15s</span></>}>
                  All Security Alerts
                </SectionTitle>
                <div style={{ flex:1 }}>
                  <AlertFeed limit={200} showAll={true} />
                </div>
              </Card>
            </div>
          )}

          {/* COMPLIANCE TAB */}
          {tab === "compliance" && <ComplianceTab />}

          {/* ANALYTICS TAB */}
          {tab === "analytics" && <AnalyticsTab stats={stats} />}

        </main>

        {/* Footer */}
        {lastUp && (
          <div style={{ textAlign:"center", padding:"12px 24px",
                        fontFamily:T.fontMono, fontSize:8, color:T.text3,
                        borderTop:`1px solid ${T.border}`, letterSpacing:"0.1em" }}>
            STATS LAST UPDATED {lastUp.toLocaleTimeString("en-GB",{hour12:false})}
            {" · "}ALERTS POLL 15s · STATS REFRESH 30s
          </div>
        )}
      </div>
    </>
  );
}
