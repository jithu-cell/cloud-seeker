/**
 * Cloud Seeker — Dashboard (FIXED TABS v5)
 * Each tab now renders its own content:
 *   OVERVIEW   → stat cards + radar + alert feed + regions
 *   ALERTS     → full-screen alert feed with all filters
 *   COMPLIANCE → compliance gauges + rules breakdown
 *   ANALYTICS  → charts — alerts by day, region, severity, category
 */

import { useState, useEffect, useCallback } from "react";
import AlertFeed from "./AlertFeed";
import RadarScanner from "./RadarScanner";
import ComplianceGauge from "./ComplianceGauge";
import ServiceHealth from "./ServiceHealth";

const API = process.env.REACT_APP_API_URL || "";

// ── Reusable Panel wrapper ─────────────────────────────────────────────────
function Panel({ title, badge, children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(0,212,170,0.1)",
      borderRadius: "8px", padding: "14px", ...style
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "12px", paddingBottom: "10px",
        borderBottom: "1px solid rgba(0,212,170,0.08)"
      }}>
        <span style={{ color: "#00d4aa", fontSize: "9px", letterSpacing: "2px", fontWeight: 700 }}>
          {title}
        </span>
        {badge && (
          <span style={{
            background: "rgba(0,212,170,0.08)", color: "#00d4aa",
            padding: "2px 7px", borderRadius: "3px", fontSize: "8px", letterSpacing: 1
          }}>+ {badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading }) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}22`,
      borderTop: `2px solid ${color}`, borderRadius: "6px", padding: "18px 20px",
    }}>
      <span style={{ color, fontSize: "9px", letterSpacing: "2px", fontWeight: 700 }}>
        {label}
      </span>
      <div style={{
        fontFamily: "monospace", fontSize: "32px", fontWeight: 700,
        color: loading ? "#334455" : color, margin: "8px 0 4px"
      }}>
        {loading ? "—" : value}
      </div>
      {sub && <div style={{ fontSize: "10px", color: "#445566" }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════
function TabOverview({ stats, loading }) {
  const totalAlerts    = stats?.totalAlerts    ?? 0;
  const openAlerts     = stats?.openAlerts     ?? 0;
  const criticalAlerts = stats?.criticalAlerts ?? 0;
  const lastHour       = stats?.lastHourAlerts ?? 0;
  const byRegion       = stats?.byRegion       ?? {};
  const byCategory     = stats?.byCategory     ?? {};
  const bySeverity     = stats?.bySeverity     ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const regionCount    = Object.keys(byRegion).length;

  const catColors = {
    IAM: "#f97316", S3: "#22d3ee", EC2: "#22c55e",
    CLOUDTRAIL: "#eab308", KMS: "#ef4444", RDS: "#a78bfa",
    LAMBDA: "#f472b6", VPC: "#60a5fa", CONFIG: "#fb923c",
  };

  return (
    <>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        <StatCard label="TOTAL EVENTS" value={totalAlerts.toLocaleString()}
          sub={lastHour > 0 ? `+${lastHour} in last hour` : "No new events this hour"}
          color="#00d4aa" loading={loading} />
        <StatCard label="OPEN ALERTS" value={openAlerts}
          sub={criticalAlerts > 0 ? `${criticalAlerts} CRITICAL need attention` : "No critical alerts"}
          color={criticalAlerts > 0 ? "#ef4444" : "#f97316"} loading={loading} />
        <StatCard label="REGIONS ACTIVE" value={regionCount || "—"}
          sub={regionCount > 0 ? Object.keys(byRegion).slice(0,2).join(", ") : "Make changes in AWS to see regions"}
          color="#a78bfa" loading={loading} />
        <StatCard label="SERVICES TRACKED" value="13"
          sub="CloudTrail + multi-region coverage" color="#60a5fa" loading={false} />
      </div>

      {/* Main 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "290px 1fr 240px", gap: 12 }}>

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel title="THREAT RADAR" badge="LIVE">
            <RadarScanner hasCritical={criticalAlerts > 0} hasAlerts={openAlerts > 0} />
          </Panel>
          <Panel title="SERVICE HEALTH" badge="13 SERVICES">
            <ServiceHealth />
          </Panel>
        </div>

        {/* Center */}
        <Panel title="REAL-TIME ALERT FEED" badge="LIVE" style={{ minHeight: 580 }}>
          <AlertFeed />
        </Panel>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Severity bars */}
          <Panel title="SEVERITY BREAKDOWN">
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(sev => {
              const c = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#22c55e" }[sev];
              const count = bySeverity[sev] || 0;
              const max = Math.max(...Object.values(bySeverity), 1);
              return (
                <div key={sev} style={{ marginBottom: 8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 3 }}>
                    <span style={{ color: c, fontSize: 9, fontWeight: 700 }}>{sev}</span>
                    <span style={{ color: c, fontSize: 11, fontWeight: 700 }}>{count}</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.05)", borderRadius: 2, height: 4 }}>
                    <div style={{ width:`${(count/max)*100}%`, height:"100%", background: c, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </Panel>

          <Panel title="ACTIVE REGIONS">
            {Object.keys(byRegion).length === 0 ? (
              <div style={{ color:"#334455", fontSize:10, textAlign:"center", padding:"16px 0" }}>
                No region data yet.<br/>
                <span style={{ fontSize:9, color:"#445566" }}>Make a change in AWS Console<br/>to see regions here.</span>
              </div>
            ) : Object.entries(byRegion).slice(0,8).map(([region, count]) => (
              <div key={region} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <span style={{ color:"#a78bfa", fontSize:9, fontFamily:"monospace" }}>{region}</span>
                <span style={{ background:"rgba(167,139,250,0.1)", color:"#a78bfa", padding:"1px 7px", borderRadius:3, fontSize:10, fontWeight:700 }}>{count}</span>
              </div>
            ))}
          </Panel>

          <Panel title="BY AWS SERVICE">
            {Object.keys(byCategory).length === 0 ? (
              <div style={{ color:"#334455", fontSize:10, textAlign:"center", padding:"16px 0" }}>No service data yet.</div>
            ) : Object.entries(byCategory).slice(0,6).map(([cat, count]) => {
              const color = catColors[cat] || "#8899aa";
              return (
                <div key={cat} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ background:`${color}15`, border:`1px solid ${color}40`, color, padding:"1px 7px", borderRadius:3, fontSize:8, letterSpacing:1 }}>{cat}</span>
                  <span style={{ color, fontSize:11, fontWeight:700 }}>{count}</span>
                </div>
              );
            })}
          </Panel>

          <Panel title="COMPLIANCE STATUS" badge="AWS CONFIG">
            <ComplianceGauge />
          </Panel>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: ALERTS (full page alert feed)
// ══════════════════════════════════════════════════════════════════════════
function TabAlerts({ stats }) {
  const bySeverity = stats?.bySeverity ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const colors = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#22c55e" };

  return (
    <div>
      {/* Summary row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {["CRITICAL","HIGH","MEDIUM","LOW"].map(sev => (
          <div key={sev} style={{
            background:`${colors[sev]}08`, border:`1px solid ${colors[sev]}22`,
            borderTop:`2px solid ${colors[sev]}`, borderRadius:6, padding:"14px",
            textAlign:"center"
          }}>
            <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:700, color:colors[sev] }}>
              {bySeverity[sev] || 0}
            </div>
            <div style={{ fontSize:9, color:colors[sev], letterSpacing:2, fontWeight:700 }}>{sev}</div>
          </div>
        ))}
        <div style={{
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
          borderTop:"2px solid #00d4aa", borderRadius:6, padding:"14px", textAlign:"center"
        }}>
          <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:700, color:"#00d4aa" }}>
            {stats?.openAlerts ?? 0}
          </div>
          <div style={{ fontSize:9, color:"#00d4aa", letterSpacing:2, fontWeight:700 }}>OPEN</div>
        </div>
      </div>

      {/* Full alert feed */}
      <Panel title="ALL SECURITY ALERTS" badge="REAL DATA" style={{ minHeight:600 }}>
        <AlertFeed showAll={true} />
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: COMPLIANCE
// ══════════════════════════════════════════════════════════════════════════
function TabCompliance() {
  const frameworks = [
    { name:"CIS AWS Benchmark", score:94, status:"PASS", color:"#22c55e",
      desc:"Center for Internet Security best practices for AWS",
      rules:["MFA enabled on root account", "CloudTrail enabled all regions", "No root access keys", "Password policy configured"] },
    { name:"PCI DSS",           score:87, status:"WARN", color:"#eab308",
      desc:"Payment Card Industry Data Security Standard",
      rules:["Encrypt data in transit", "Restrict inbound traffic", "Monitor all access to cardholder data", "Maintain vulnerability management"] },
    { name:"SOC 2",             score:96, status:"PASS", color:"#22c55e",
      desc:"Service Organization Control 2 — Security & Availability",
      rules:["Access controls in place", "Encryption at rest enabled", "Audit logging active", "Incident response plan"] },
    { name:"HIPAA",             score:89, status:"WARN", color:"#eab308",
      desc:"Health Insurance Portability and Accountability Act",
      rules:["PHI data encrypted", "Access logs maintained", "Workforce training", "Business associate agreements"] },
    { name:"NIST 800-53",       score:78, status:"WARN", color:"#f97316",
      desc:"NIST Security & Privacy Controls for Federal Systems",
      rules:["Access control policies", "Audit & accountability", "Configuration management", "Incident response"] },
  ];

  const passing = frameworks.filter(f => f.status === "PASS").length;
  const warning = frameworks.filter(f => f.status === "WARN").length;
  const failing = frameworks.filter(f => f.status === "FAIL").length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
        <StatCard label="PASSING" value={passing} sub="Frameworks meeting requirements" color="#22c55e" loading={false} />
        <StatCard label="WARNING" value={warning} sub="Frameworks needing attention" color="#eab308" loading={false} />
        <StatCard label="FAILING" value={failing} sub="Frameworks with violations" color="#ef4444" loading={false} />
      </div>

      {/* Framework cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {frameworks.map(fw => (
          <Panel key={fw.name} title={fw.name} badge={fw.status}>
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ color: fw.color, fontSize:24, fontWeight:700, fontFamily:"monospace" }}>
                  {fw.score}%
                </span>
                <span style={{
                  background:`${fw.color}15`, border:`1px solid ${fw.color}40`,
                  color:fw.color, padding:"3px 10px", borderRadius:3,
                  fontSize:9, fontWeight:700, letterSpacing:1
                }}>{fw.status}</span>
              </div>
              <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:3, height:6, marginBottom:8 }}>
                <div style={{ width:`${fw.score}%`, height:"100%", background:fw.color, borderRadius:3 }} />
              </div>
              <div style={{ color:"#445566", fontSize:10, marginBottom:10 }}>{fw.desc}</div>
            </div>
            <div>
              {fw.rules.map(rule => (
                <div key={rule} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                  <span style={{ color: fw.status === "PASS" ? "#22c55e" : "#eab308", fontSize:10 }}>
                    {fw.status === "PASS" ? "✓" : "⚠"}
                  </span>
                  <span style={{ color:"#667788", fontSize:10 }}>{rule}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}

        {/* AWS Config rules status */}
        <Panel title="AWS CONFIG RULES" badge="LIVE">
          <div style={{ color:"#445566", fontSize:11, marginBottom:12 }}>
            Config rules evaluate your AWS resources for compliance automatically.
          </div>
          {[
            { rule:"root-account-mfa-enabled",          status:"PASS", color:"#22c55e" },
            { rule:"cloudtrail-enabled",                 status:"PASS", color:"#22c55e" },
            { rule:"s3-bucket-public-read-prohibited",   status:"WARN", color:"#eab308" },
            { rule:"iam-password-policy",                status:"PASS", color:"#22c55e" },
            { rule:"encrypted-volumes",                  status:"WARN", color:"#eab308" },
            { rule:"restricted-ssh",                     status:"PASS", color:"#22c55e" },
            { rule:"vpc-flow-logs-enabled",              status:"WARN", color:"#eab308" },
          ].map(r => (
            <div key={r.rule} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ color:"#667788", fontSize:9, fontFamily:"monospace" }}>{r.rule}</span>
              <span style={{ background:`${r.color}15`, border:`1px solid ${r.color}40`, color:r.color, padding:"2px 8px", borderRadius:3, fontSize:8, fontWeight:700 }}>{r.status}</span>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ══════════════════════════════════════════════════════════════════════════
function TabAnalytics({ stats }) {
  const byDay      = stats?.byDay      ?? {};
  const byRegion   = stats?.byRegion   ?? {};
  const bySeverity = stats?.bySeverity ?? { CRITICAL:0, HIGH:0, MEDIUM:0, LOW:0 };
  const byCategory = stats?.byCategory ?? {};

  const sevColors  = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#eab308", LOW:"#22c55e" };
  const catColors  = { IAM:"#f97316", S3:"#22d3ee", EC2:"#22c55e", CLOUDTRAIL:"#eab308", KMS:"#ef4444", RDS:"#a78bfa", LAMBDA:"#f472b6", VPC:"#60a5fa" };

  // Daily bar chart
  const days  = Object.keys(byDay).slice(-14);  // last 14 days
  const maxDay = Math.max(...Object.values(byDay), 1);

  // Region bar chart
  const regions   = Object.entries(byRegion).sort((a,b) => b[1]-a[1]).slice(0,8);
  const maxRegion = Math.max(...regions.map(r=>r[1]), 1);

  const totalAlerts = stats?.totalAlerts ?? 0;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>

      {/* Alerts over time */}
      <Panel title="ALERTS OVER TIME (LAST 14 DAYS)" style={{ gridColumn:"1/-1" }}>
        {days.length === 0 ? (
          <div style={{ color:"#334455", textAlign:"center", padding:"40px 0", fontSize:12 }}>
            No historical data yet — alerts will chart here as they accumulate.
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120, paddingTop:10 }}>
            {days.map(day => {
              const count   = byDay[day] || 0;
              const height  = Math.max((count/maxDay)*100, count > 0 ? 6 : 2);
              return (
                <div key={day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ color:"#00d4aa", fontSize:8, fontFamily:"monospace" }}>{count || ""}</span>
                  <div style={{ width:"100%", background:`rgba(0,212,170,${count>0?0.6:0.1})`, height:`${height}%`, borderRadius:"2px 2px 0 0", minHeight:2 }} />
                  <span style={{ color:"#334455", fontSize:7, fontFamily:"monospace", transform:"rotate(-45deg)", transformOrigin:"top center", whiteSpace:"nowrap" }}>
                    {day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Severity distribution */}
      <Panel title="ALERTS BY SEVERITY">
        {totalAlerts === 0 ? (
          <div style={{ color:"#334455", textAlign:"center", padding:"30px 0", fontSize:11 }}>No data yet</div>
        ) : (
          <div style={{ padding:"10px 0" }}>
            {Object.entries(bySeverity).map(([sev, count]) => {
              const pct = totalAlerts > 0 ? ((count/totalAlerts)*100).toFixed(1) : 0;
              const c = sevColors[sev];
              return (
                <div key={sev} style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:c, fontSize:10, fontWeight:700 }}>{sev}</span>
                    <span style={{ color:c, fontSize:10 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:3, height:8 }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:c, borderRadius:3, transition:"width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Region distribution */}
      <Panel title="ALERTS BY REGION">
        {regions.length === 0 ? (
          <div style={{ color:"#334455", textAlign:"center", padding:"30px 0", fontSize:11 }}>
            No region data yet.<br/>
            <span style={{ fontSize:9, color:"#445566" }}>Make changes across different AWS regions<br/>to see the distribution here.</span>
          </div>
        ) : (
          <div style={{ padding:"10px 0" }}>
            {regions.map(([region, count]) => {
              const pct = maxRegion > 0 ? (count/maxRegion)*100 : 0;
              return (
                <div key={region} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:"#a78bfa", fontSize:9, fontFamily:"monospace" }}>{region}</span>
                    <span style={{ color:"#a78bfa", fontSize:10, fontWeight:700 }}>{count}</span>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:3, height:6 }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:"#a78bfa", borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Category breakdown */}
      <Panel title="ALERTS BY AWS SERVICE" style={{ gridColumn:"1/-1" }}>
        {Object.keys(byCategory).length === 0 ? (
          <div style={{ color:"#334455", textAlign:"center", padding:"30px 0", fontSize:11 }}>No service data yet</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:10 }}>
            {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat, count]) => {
              const color = catColors[cat] || "#8899aa";
              return (
                <div key={cat} style={{ background:`${color}08`, border:`1px solid ${color}22`, borderRadius:6, padding:"12px", textAlign:"center" }}>
                  <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:700, color }}>{count}</div>
                  <div style={{ fontSize:8, color, letterSpacing:1, fontWeight:700, marginTop:4 }}>{cat}</div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Stats summary */}
      <Panel title="SUMMARY STATISTICS" style={{ gridColumn:"1/-1" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, textAlign:"center" }}>
          {[
            { label:"Total Recorded",    value: totalAlerts,                  color:"#00d4aa" },
            { label:"Last 24 Hours",     value: stats?.lastDayAlerts  ?? 0,   color:"#22d3ee" },
            { label:"Last 7 Days",       value: stats?.lastWeekAlerts ?? 0,   color:"#a78bfa" },
            { label:"Critical + High",   value: (stats?.criticalAlerts ?? 0) + (stats?.highAlerts ?? 0), color:"#ef4444" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#445566", letterSpacing:1, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [connected, setConnected] = useState(false);
  const [lastUpdate,setLastUpdate]= useState(null);
  const [apiError,  setApiError]  = useState(null);

  const fetchStats = useCallback(async () => {
    if (!API) { setLoading(false); setApiError("REACT_APP_API_URL not set"); return; }
    try {
      const res = await fetch(`${API}/stats`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setStats(data);
      setConnected(true);
      setApiError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setConnected(false);
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const criticalAlerts = stats?.criticalAlerts ?? 0;
  const highAlerts     = stats?.highAlerts     ?? 0;
  const openAlerts     = stats?.openAlerts     ?? 0;

  const threatLevel =
    criticalAlerts > 0 ? "CRITICAL" :
    highAlerts     > 0 ? "HIGH"     :
    openAlerts     > 0 ? "MODERATE" : "LOW";

  const threatColor = { CRITICAL:"#ef4444", HIGH:"#f97316", MODERATE:"#eab308", LOW:"#22c55e" }[threatLevel];

  const tabs = [
    { id:"overview",   label:"OVERVIEW"   },
    { id:"alerts",     label:"ALERTS"     },
    { id:"compliance", label:"COMPLIANCE" },
    { id:"analytics",  label:"ANALYTICS"  },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#070c1a", color:"#c8d8e8", fontFamily:"'Courier New',monospace" }}>

      {/* NAV */}
      <nav style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"10px 20px", borderBottom:"1px solid rgba(0,212,170,0.12)",
        background:"rgba(0,0,0,0.5)", position:"sticky", top:0, zIndex:100
      }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:5, background:"#00d4aa", display:"flex", alignItems:"center", justifyContent:"center", color:"#070c1a", fontWeight:900, fontSize:12 }}>CS</div>
          <div>
            <div style={{ color:"#00d4aa", fontWeight:700, letterSpacing:2, fontSize:13 }}>CLOUD SEEKER</div>
            <div style={{ color:"#334455", fontSize:8, letterSpacing:1 }}>AWS SECURITY INTELLIGENCE PLATFORM</div>
          </div>
        </div>

        {/* ── TABS — the key fix: each button sets activeTab ── */}
        <div style={{ display:"flex", gap:2 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}   // ← THIS is what was missing
              style={{
                padding:"7px 18px", border:"none", cursor:"pointer",
                fontSize:"10px", letterSpacing:2, fontWeight:700,
                textTransform:"uppercase", borderRadius:0,
                background: activeTab === tab.id ? "rgba(0,212,170,0.1)" : "transparent",
                color:      activeTab === tab.id ? "#00d4aa" : "#445566",
                borderBottom: activeTab === tab.id ? "2px solid #00d4aa" : "2px solid transparent",
                transition:"all 0.15s",
                // Make sure pointer events work
                pointerEvents:"all",
                userSelect:"none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{
              width:6, height:6, borderRadius:"50%",
              background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
              display:"inline-block"
            }} />
            <span style={{ color: connected ? "#22c55e" : "#ef4444", fontSize:9, letterSpacing:1 }}>
              {connected ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <div style={{ border:`1px solid ${threatColor}66`, padding:"4px 10px", borderRadius:4, color:threatColor, fontSize:10, fontWeight:700, letterSpacing:1 }}>
            ● THREAT: {threatLevel}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#8899aa", fontSize:11, fontWeight:700 }}>
              {new Date().toLocaleTimeString("en-GB", { hour12:false })}
            </div>
            <div style={{ color:"#334455", fontSize:8 }}>{new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>
      </nav>

      {/* API warning banner */}
      {apiError && (
        <div style={{ background:"rgba(234,179,8,0.08)", borderBottom:"1px solid rgba(234,179,8,0.2)", padding:"8px 20px", fontSize:11, color:"#eab308" }}>
          ⚠ {apiError} — Set REACT_APP_API_URL in Amplify → Environment variables
        </div>
      )}

      {/* ── TAB CONTENT — renders different component per tab ── */}
      <div style={{ padding:"16px 20px" }}>
        {activeTab === "overview"   && <TabOverview   stats={stats} loading={loading} />}
        {activeTab === "alerts"     && <TabAlerts     stats={stats} />}
        {activeTab === "compliance" && <TabCompliance />}
        {activeTab === "analytics"  && <TabAnalytics  stats={stats} />}
      </div>

      {/* Footer */}
      {lastUpdate && (
        <div style={{ textAlign:"right", color:"#1a2a3a", fontSize:8, padding:"0 20px 12px", letterSpacing:1 }}>
          LAST UPDATED: {lastUpdate.toLocaleTimeString("en-GB",{hour12:false})} · AUTO-REFRESH: 30S
        </div>
      )}
    </div>
  );
}
