import { useState, useEffect, useCallback } from "react";
import AlertFeed from "./AlertFeed";
import ComplianceGauge from "./ComplianceGauge";
import ServiceHealth from "./ServiceHealth";
import RadarScanner from "./RadarScanner";
import MetricCard from "./MetricCard";

const API = process.env.REACT_APP_API_URL || "";

async function apiFetch(path) {
  if (!API) return null;
  try {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

// ─── Demo data ─────────────────────────────────────────────────────────────
const DEMO_ALERTS = [
  { alert_id: "1", event_name: "ConsoleLogin", severity: "CRITICAL", reason: "Root account login detected", event_source: "signin.amazonaws.com", region: "us-east-1", event_time: new Date().toISOString(), status: "OPEN", user: "root", source_ip: "1.2.3.4" },
  { alert_id: "2", event_name: "AuthorizeSecurityGroupIngress", severity: "HIGH", reason: "Security group opened to world on port 22", event_source: "ec2.amazonaws.com", region: "us-west-2", event_time: new Date(Date.now()-300000).toISOString(), status: "OPEN", user: "admin", source_ip: "5.6.7.8" },
  { alert_id: "3", event_name: "PutBucketAcl", severity: "HIGH", reason: "S3 bucket made public", event_source: "s3.amazonaws.com", region: "eu-north-1", event_time: new Date(Date.now()-600000).toISOString(), status: "RESOLVED" },
  { alert_id: "4", event_name: "DeleteTrail", severity: "CRITICAL", reason: "CloudTrail logging disabled", event_source: "cloudtrail.amazonaws.com", region: "us-east-1", event_time: new Date(Date.now()-900000).toISOString(), status: "OPEN" },
];
const DEMO_COMPLIANCE = { score: 91, compliant_rules: 18, non_compliant_rules: 3, total_rules: 21, framework_scores: { cis: 94, pci: 87, soc2: 96, hipaa: 89, nist: 78 }, rules: [{ name: "root-mfa-enabled", status: "COMPLIANT" }, { name: "s3-bucket-public-read-prohibited", status: "NON_COMPLIANT" }, { name: "cloudtrail-enabled", status: "COMPLIANT" }, { name: "iam-password-policy", status: "COMPLIANT" }, { name: "vpc-flow-logs-enabled", status: "NON_COMPLIANT" }] };
const DEMO_STATS = { total_alerts_24h: 27, threats_last_hour: 3, open_critical: 2, by_severity: { CRITICAL: 2, HIGH: 5, MEDIUM: 12, LOW: 8 }, resolved_today: 14 };
const DEMO_TOP_THREATS = [{ name: "S3 Public Access", count: 8, pct: 80, color: "#ef4444" }, { name: "Security Group Changes", count: 6, pct: 60, color: "#f97316" }, { name: "IAM Policy Modified", count: 5, pct: 50, color: "#f59e0b" }, { name: "Root Login", count: 3, pct: 30, color: "#8b5cf6" }, { name: "CloudTrail Disabled", count: 2, pct: 20, color: "#3b82f6" }];
const DEMO_PIE = [{ name: "IAM", pct: 35, color: "#ef4444" }, { name: "S3", pct: 28, color: "#3b82f6" }, { name: "EC2", pct: 20, color: "#f59e0b" }, { name: "CloudTrail", pct: 17, color: "#8b5cf6" }];

// ─── OverviewTab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  return (
    <div className="main-grid">
      <div className="left-col">
        <div className="panel">
          <div className="panel-header"><span className="panel-title">THREAT RADAR</span><span className="panel-badge live">● LIVE</span></div>
          <RadarScanner />
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">SERVICE HEALTH</span><span className="panel-badge">13 SERVICES</span></div>
          <ServiceHealth />
        </div>
      </div>
      <div className="center-col">
        <div className="panel panel-tall">
          <div className="panel-header"><span className="panel-title">REAL-TIME ALERT FEED</span><span className="panel-badge live">● STREAMING</span></div>
          <AlertFeed apiUrl={API} />
        </div>
      </div>
      <div className="right-col">
        <div className="panel">
          <div className="panel-header"><span className="panel-title">COMPLIANCE STATUS</span><span className="panel-badge">AWS CONFIG</span></div>
          <ComplianceGauge apiUrl={API} />
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">ARCHITECTURE FLOW</span></div>
          <ArchitectureFlow />
        </div>
      </div>
    </div>
  );
}

// ─── AlertsTab ────────────────────────────────────────────────────────────────
function AlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [resolving, setResolving] = useState(null);

  const load = useCallback(async () => {
    const data = await apiFetch("/alerts?limit=100");
    setAlerts(data?.alerts?.length > 0 ? data.alerts : DEMO_ALERTS);
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const resolve = async (id) => {
    setResolving(id);
    if (API) await apiFetch(`/alerts/${id}/resolve`);
    setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, status: "RESOLVED" } : a));
    setResolving(null);
  };

  const counts = alerts.reduce((a, x) => { a[x.severity] = (a[x.severity] || 0) + 1; return a; }, {});
  const filtered = filter === "ALL" ? alerts : alerts.filter(a => a.severity === filter);
  const SEVS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

  return (
    <div className="tab-fullpage">
      <div className="alerts-summary-bar">
        {["CRITICAL","HIGH","MEDIUM","LOW"].map(s => (
          <div key={s} className={`summary-chip sev-${s.toLowerCase()}`} onClick={() => setFilter(s)} style={{cursor:"pointer"}}>
            <span className="summary-count">{counts[s] || 0}</span>
            <span className="summary-label">{s}</span>
          </div>
        ))}
        <div className="summary-chip" style={{marginLeft:"auto"}}>
          <span className="summary-count">{alerts.length}</span>
          <span className="summary-label">TOTAL</span>
        </div>
      </div>
      <div className="filter-row">
        {SEVS.map(s => <button key={s} className={`filter-btn ${filter===s?"active":""}`} onClick={() => setFilter(s)}>{s}</button>)}
        <button className="filter-btn refresh-btn" onClick={load}>↻ REFRESH</button>
      </div>
      {loading ? (
        <div className="tab-loading"><div className="spinner" /><span>Loading alerts...</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">✓</div><p>No {filter !== "ALL" ? filter : ""} alerts</p><span>System secure — no threats detected</span></div>
      ) : (
        <div className="alerts-table-wrap">
          {filtered.map(alert => (
            <div key={alert.alert_id} className={`alert-row sev-border-${(alert.severity||"medium").toLowerCase()} ${alert.status==="RESOLVED"?"resolved":""}`}>
              <div className="alert-row-top">
                <span className={`sev-badge sev-${(alert.severity||"medium").toLowerCase()}`}>{alert.severity||"MED"}</span>
                <span className="alert-name">{alert.event_name || alert.type || "Security Event"}</span>
                <span className="alert-source">{alert.event_source || alert.source || "AWS"}</span>
                <span className="alert-region">{alert.region || "—"}</span>
                <span className="alert-time">{alert.event_time ? new Date(alert.event_time).toLocaleTimeString() : "—"}</span>
                {alert.status === "OPEN" && <button className="resolve-btn" onClick={() => resolve(alert.alert_id)} disabled={resolving===alert.alert_id}>{resolving===alert.alert_id?"...":"RESOLVE"}</button>}
                {alert.status === "RESOLVED" && <span className="resolved-tag">✓ RESOLVED</span>}
              </div>
              <div className="alert-row-detail">
                <span className="alert-reason">{alert.reason || "Event detected"}</span>
                {alert.user && <span className="alert-user">User: {alert.user}</span>}
                {alert.source_ip && <span className="alert-ip">IP: {alert.source_ip}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ComplianceTab ────────────────────────────────────────────────────────────
function ComplianceTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const d = await apiFetch("/compliance"); setData(d || DEMO_COMPLIANCE); setLoading(false); })(); }, []);
  const s = data || DEMO_COMPLIANCE;
  const fw = [
    { name: "CIS AWS Benchmark", key: "cis", color: "#00d4aa" },
    { name: "PCI DSS", key: "pci", color: "#3b82f6" },
    { name: "SOC 2", key: "soc2", color: "#8b5cf6" },
    { name: "HIPAA", key: "hipaa", color: "#f59e0b" },
    { name: "NIST 800-53", key: "nist", color: "#ec4899" },
  ];
  const scores = s.framework_scores || { cis:94, pci:87, soc2:96, hipaa:89, nist:78 };
  return (
    <div className="tab-fullpage">
      {loading ? <div className="tab-loading"><div className="spinner" /><span>Loading compliance data...</span></div> : (
        <>
          <div className="compliance-overview">
            <div className="compliance-big-score">
              <svg viewBox="0 0 120 120" width="140" height="140">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1a2a3a" strokeWidth="8"/>
                <circle cx="60" cy="60" r="50" fill="none" stroke="#00d4aa" strokeWidth="8" strokeDasharray={`${(s.score||91)*3.14} 314`} strokeLinecap="round" transform="rotate(-90 60 60)"/>
                <text x="60" y="55" textAnchor="middle" fill="#00d4aa" fontSize="22" fontWeight="700" fontFamily="monospace">{s.score||91}%</text>
                <text x="60" y="72" textAnchor="middle" fill="#6b8a9a" fontSize="9" fontFamily="monospace">OVERALL</text>
              </svg>
              <div className="compliance-summary-stats">
                <div className="comp-stat green"><span className="cs-num">{s.compliant_rules||18}</span><span className="cs-label">PASSING</span></div>
                <div className="comp-stat amber"><span className="cs-num">{s.non_compliant_rules||3}</span><span className="cs-label">FAILING</span></div>
                <div className="comp-stat blue"><span className="cs-num">{s.total_rules||21}</span><span className="cs-label">TOTAL</span></div>
              </div>
            </div>
          </div>
          <div className="compliance-frameworks">
            <div className="section-title">FRAMEWORK SCORES</div>
            {fw.map(f => { const sc=scores[f.key]||0; const st=sc>=90?"PASS":sc>=70?"WARN":"FAIL"; return (
              <div key={f.key} className="fw-row">
                <span className="fw-name">{f.name}</span>
                <div className="fw-bar-track"><div className="fw-bar-fill" style={{width:`${sc}%`,background:f.color,transition:"width 1s ease"}}/></div>
                <span className="fw-pct" style={{color:f.color}}>{sc}%</span>
                <span className={`fw-status status-${st.toLowerCase()}`}>{st}</span>
              </div>
            );})}
          </div>
          {s.rules && s.rules.length > 0 && (
            <div className="compliance-rules">
              <div className="section-title">AWS CONFIG RULES</div>
              {s.rules.map((r,i) => (
                <div key={i} className="rule-row">
                  <span className={`rule-dot ${r.status==="COMPLIANT"?"green":"red"}`}/>
                  <span className="rule-name">{r.name}</span>
                  <span className={`rule-status ${r.status==="COMPLIANT"?"green":"red"}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── AnalyticsTab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => { (async () => { const d = await apiFetch("/stats"); setStats(d || DEMO_STATS); })(); }, []);
  const s = stats || DEMO_STATS;
  const bySev = s.by_severity || { CRITICAL:2, HIGH:5, MEDIUM:12, LOW:8 };
  const maxV = Math.max(...Object.values(bySev), 1);
  const sevColors = { CRITICAL:"#ef4444", HIGH:"#f97316", MEDIUM:"#f59e0b", LOW:"#22c55e" };
  const spark = [4,7,3,9,12,6,8,15,11,7,4,9,13,6,8,10,7,5,9,14,8,6,11,7];
  const sparkMax = Math.max(...spark);
  return (
    <div className="tab-fullpage">
      <div className="analytics-kpis">
        <div className="kpi-card"><span className="kpi-label">ALERTS 24H</span><span className="kpi-value teal">{s.total_alerts_24h||27}</span></div>
        <div className="kpi-card"><span className="kpi-label">THREATS/HOUR</span><span className="kpi-value red">{s.threats_last_hour||3}</span></div>
        <div className="kpi-card"><span className="kpi-label">OPEN CRITICAL</span><span className="kpi-value orange">{s.open_critical||2}</span></div>
        <div className="kpi-card"><span className="kpi-label">RESOLVED TODAY</span><span className="kpi-value green">{s.resolved_today||14}</span></div>
      </div>
      <div className="analytics-grid">
        <div className="panel analytics-chart">
          <div className="panel-header"><span className="panel-title">ALERTS BY SEVERITY</span></div>
          <div className="bar-chart">
            {Object.entries(bySev).map(([sev,count]) => (
              <div key={sev} className="bar-col">
                <span className="bar-count">{count}</span>
                <div className="bar-fill" style={{height:`${(count/maxV)*140}px`,background:sevColors[sev],transition:"height 1s ease"}}/>
                <span className="bar-label" style={{color:sevColors[sev]}}>{sev}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel analytics-chart">
          <div className="panel-header"><span className="panel-title">ACTIVITY (24H)</span><span className="panel-badge">HOURLY</span></div>
          <div className="sparkline-wrap">
            <svg width="100%" viewBox={`0 0 ${spark.length*12} 80`} preserveAspectRatio="none">
              <polyline points={spark.map((v,i)=>`${i*12+6},${80-(v/sparkMax)*65}`).join(" ")} fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
              {spark.map((v,i)=><circle key={i} cx={i*12+6} cy={80-(v/sparkMax)*65} r="2" fill="#00d4aa"/>)}
            </svg>
          </div>
        </div>
        <div className="panel analytics-chart">
          <div className="panel-header"><span className="panel-title">TOP THREAT TYPES</span></div>
          <div className="threat-list">
            {DEMO_TOP_THREATS.map((t,i)=>(
              <div key={i} className="threat-list-row">
                <span className="tl-rank">#{i+1}</span>
                <span className="tl-name">{t.name}</span>
                <div className="tl-bar-track"><div className="tl-bar" style={{width:`${t.pct}%`,background:t.color,transition:`width ${1+i*0.1}s ease`}}/></div>
                <span className="tl-count" style={{color:t.color}}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel analytics-chart">
          <div className="panel-header"><span className="panel-title">SERVICES AFFECTED</span></div>
          <div className="services-donut">
            <svg viewBox="0 0 120 120" width="120" height="120">
              {DEMO_PIE.map((seg,i)=>{
                const offset=DEMO_PIE.slice(0,i).reduce((a,s)=>a+s.pct,0);
                return <circle key={i} cx="60" cy="60" r="44" fill="none" stroke={seg.color} strokeWidth="18" strokeDasharray={`${seg.pct*2.76} 276`} strokeDashoffset={-offset*2.76} transform="rotate(-90 60 60)"/>;
              })}
              <text x="60" y="56" textAnchor="middle" fill="#6b8a9a" fontSize="8" fontFamily="monospace">EVENTS</text>
              <text x="60" y="68" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="700" fontFamily="monospace">{s.total_alerts_24h||27}</text>
            </svg>
            <div className="donut-legend">
              {DEMO_PIE.map((seg,i)=>(
                <div key={i} className="donut-leg-row">
                  <span className="donut-dot" style={{background:seg.color}}/>
                  <span className="donut-name">{seg.name}</span>
                  <span className="donut-pct" style={{color:seg.color}}>{seg.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ArchitectureFlow ────────────────────────────────────────────────────────
function ArchitectureFlow() {
  const nodes = [{label:"CloudTrail",color:"#f59e0b"},{label:"S3",color:"#3b82f6"},{label:"EventBridge",color:"#8b5cf6"},{label:"Step Fn",color:"#06b6d4"},{label:"Lambda",color:"#00d4aa"},{label:"DynamoDB",color:"#f59e0b"},{label:"API Gateway",color:"#ec4899"}];
  return (
    <div className="arch-flow">
      {nodes.map((node,i)=>(
        <div key={node.label} className="arch-node-row">
          <div className="arch-node" style={{borderColor:node.color}}>
            <span className="arch-dot" style={{background:node.color}}/>
            <span className="arch-label">{node.label}</span>
          </div>
          {i<nodes.length-1 && <div className="arch-arrow"><div className="arch-line" style={{background:node.color}}/><span className="arch-chevron">▼</span></div>}
        </div>
      ))}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState({ totalEvents: 48291, criticalAlerts: 7, complianceScore: 91, servicesMonitored: 13 });
  const [activeTab, setActiveTab] = useState("overview");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [threatLevel, setThreatLevel] = useState("MODERATE");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setStats(prev => ({ ...prev, totalEvents: prev.totalEvents + Math.floor(Math.random() * 5) }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      const data = await apiFetch("/stats");
      if (data) {
        setStats(prev => ({ ...prev, criticalAlerts: data.open_critical || prev.criticalAlerts }));
        setThreatLevel(data.open_critical >= 5 ? "CRITICAL" : data.open_critical >= 2 ? "HIGH" : "LOW");
      }
    })();
  }, []);

  return (
    <div className="dashboard-root">
      <div className="bg-grid" /><div className="bg-scanline" />
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">
            <div className="logo-hex">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="#00d4aa" strokeWidth="1.5"/>
                <polygon points="18,8 27,13 27,23 18,28 9,23 9,13" fill="#00d4aa" opacity="0.15" stroke="#00d4aa" strokeWidth="0.5"/>
                <text x="18" y="22" textAnchor="middle" fill="#00d4aa" fontSize="10" fontWeight="700" fontFamily="monospace">CS</text>
              </svg>
            </div>
          </div>
          <div><h1 className="logo-title">CLOUD SEEKER</h1><p className="logo-sub">AWS Security Intelligence Platform</p></div>
        </div>
        <nav className="nav-tabs">
          {["overview","alerts","compliance","analytics"].map(tab => (
            <button key={tab} className={`nav-tab ${activeTab===tab?"active":""}`} onClick={() => setActiveTab(tab)}>{tab.toUpperCase()}</button>
          ))}
        </nav>
        <div className="header-right">
          <div className={`threat-badge threat-${threatLevel.toLowerCase()}`}><span className="threat-dot"/>THREAT: {threatLevel}</div>
          <div className="clock">
            <div className="clock-time">{currentTime.toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
            <div className="clock-date">{currentTime.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
          </div>
        </div>
      </header>
      <main className="main-content">
        <div className="metrics-row">
          <MetricCard label="TOTAL EVENTS" value={stats.totalEvents.toLocaleString()} delta="+124 last hour" color="teal" icon="⬡"/>
          <MetricCard label="CRITICAL ALERTS" value={stats.criticalAlerts} delta="2 unresolved" color="red" icon="⚠"/>
          <MetricCard label="COMPLIANCE SCORE" value={`${stats.complianceScore}%`} delta="+3% this week" color="green" icon="✦"/>
          <MetricCard label="SERVICES ACTIVE" value={stats.servicesMonitored} delta="All healthy" color="blue" icon="◈"/>
        </div>
        {activeTab === "overview"    && <OverviewTab />}
        {activeTab === "alerts"      && <AlertsTab />}
        {activeTab === "compliance"  && <ComplianceTab />}
        {activeTab === "analytics"   && <AnalyticsTab />}
      </main>
    </div>
  );
}
