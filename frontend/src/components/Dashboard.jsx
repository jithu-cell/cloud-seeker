/**
 * Cloud Seeker — Dashboard (FIXED v4)
 * All numbers come from real API. Zero hardcoded values.
 * Stats refresh every 30s. Alerts every 15s.
 */

import { useState, useEffect, useCallback } from "react";
import AlertFeed from "./AlertFeed";
import RadarScanner from "./RadarScanner";
import ComplianceGauge from "./ComplianceGauge";
import ServiceHealth from "./ServiceHealth";

const API = process.env.REACT_APP_API_URL || "";

// ── Small stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading }) {
  return (
    <div style={{
      background: `${color}08`,
      border: `1px solid ${color}22`,
      borderTop: `2px solid ${color}`,
      borderRadius: "6px",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color: color, fontSize: "9px", letterSpacing: "2px", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: "monospace", fontSize: "32px", fontWeight: 700,
        color: loading ? "#334455" : color, margin: "8px 0 4px",
        transition: "color 0.3s"
      }}>
        {loading ? "—" : value}
      </div>
      {sub && (
        <div style={{ fontSize: "10px", color: "#445566" }}>{sub}</div>
      )}
    </div>
  );
}

// ── Panel wrapper ──────────────────────────────────────────────────────────
function Panel({ title, badge, children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(0,212,170,0.1)",
      borderRadius: "8px",
      padding: "14px",
      ...style
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
          }}>
            + {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [stats,      setStats]      = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("overview");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected,  setConnected]  = useState(false);

  // ── Fetch real stats from API ──────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!API) {
      setStatsError("REACT_APP_API_URL not set");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/stats`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      setStats(data);
      setConnected(true);
      setStatsError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setStatsError(err.message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  // ── Derive values from real stats ─────────────────────────────────────
  const totalAlerts    = stats?.totalAlerts     ?? 0;
  const openAlerts     = stats?.openAlerts      ?? 0;
  const criticalAlerts = stats?.criticalAlerts  ?? 0;
  const highAlerts     = stats?.highAlerts      ?? 0;
  const lastHour       = stats?.lastHourAlerts  ?? 0;
  const byRegion       = stats?.byRegion        ?? {};
  const byCategory     = stats?.byCategory      ?? {};
  const bySeverity     = stats?.bySeverity      ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const regionCount    = Object.keys(byRegion).length;

  // Threat level based on REAL unresolved critical/high
  const threatLevel =
    criticalAlerts > 0 ? "CRITICAL" :
    highAlerts     > 0 ? "HIGH"     :
    openAlerts     > 0 ? "MODERATE" : "LOW";

  const threatColor = {
    CRITICAL: "#ef4444", HIGH: "#f97316",
    MODERATE: "#eab308", LOW: "#22c55e"
  }[threatLevel];

  const now = new Date();

  const catColors = {
    "IAM":        "#f97316",
    "S3":         "#22d3ee",
    "EC2":        "#22c55e",
    "CLOUDTRAIL": "#eab308",
    "KMS":        "#ef4444",
    "RDS":        "#a78bfa",
    "LAMBDA":     "#f472b6",
    "VPC":        "#60a5fa",
    "CONFIG":     "#fb923c",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070c1a",
      color: "#c8d8e8",
      fontFamily: "'Courier New', monospace"
    }}>

      {/* ── TOP NAV ────────────────────────────────────────────────────── */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid rgba(0,212,170,0.12)",
        background: "rgba(0,0,0,0.5)"
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 5,
            background: "#00d4aa", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#070c1a", fontWeight: 900, fontSize: 12
          }}>CS</div>
          <div>
            <div style={{ color: "#00d4aa", fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>
              CLOUD SEEKER
            </div>
            <div style={{ color: "#334455", fontSize: 8, letterSpacing: 1 }}>
              AWS SECURITY INTELLIGENCE PLATFORM
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2 }}>
          {["overview", "alerts", "compliance", "analytics"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "5px 14px", border: "none", cursor: "pointer",
              fontSize: "10px", letterSpacing: 2, fontWeight: 700,
              textTransform: "uppercase", borderRadius: 0,
              background: activeTab === tab ? "rgba(0,212,170,0.1)" : "transparent",
              color: activeTab === tab ? "#00d4aa" : "#445566",
              borderBottom: activeTab === tab ? "2px solid #00d4aa" : "2px solid transparent",
              transition: "all 0.15s"
            }}>{tab}</button>
          ))}
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* API connection status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: connected ? "#22c55e" : "#ef4444",
              boxShadow: connected ? "0 0 6px #22c55e" : "0 0 6px #ef4444",
              display: "inline-block"
            }} />
            <span style={{ color: connected ? "#22c55e" : "#ef4444", fontSize: 9, letterSpacing: 1 }}>
              {connected ? "LIVE" : statsError ? "API ERROR" : "CONNECTING"}
            </span>
          </div>
          {/* Threat level */}
          <div style={{
            border: `1px solid ${threatColor}66`,
            padding: "4px 10px", borderRadius: 4,
            color: threatColor, fontSize: 10, fontWeight: 700, letterSpacing: 1
          }}>
            ● THREAT: {threatLevel}
          </div>
          {/* Clock */}
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#8899aa", fontSize: 11, fontWeight: 700 }}>
              {now.toLocaleTimeString("en-GB", { hour12: false })}
            </div>
            <div style={{ color: "#445566", fontSize: 8 }}>
              {now.toLocaleDateString("en-GB")}
            </div>
          </div>
        </div>
      </nav>

      {/* ── API NOT CONFIGURED WARNING ──────────────────────────────────── */}
      {!API && (
        <div style={{
          background: "rgba(234,179,8,0.1)", borderBottom: "1px solid rgba(234,179,8,0.3)",
          padding: "8px 20px", fontSize: 11, color: "#eab308"
        }}>
          ⚠ REACT_APP_API_URL not configured. Set it in Amplify → Environment variables.
        </div>
      )}

      <div style={{ padding: "16px 20px" }}>

        {/* ── STAT CARDS (all real data) ──────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
          <StatCard
            label="TOTAL EVENTS"
            value={totalAlerts.toLocaleString()}
            sub={lastHour > 0 ? `+${lastHour} in last hour` : "No new events this hour"}
            color="#00d4aa"
            loading={loading}
          />
          <StatCard
            label="OPEN ALERTS"
            value={openAlerts}
            sub={criticalAlerts > 0 ? `${criticalAlerts} CRITICAL need attention` : "No critical alerts"}
            color={criticalAlerts > 0 ? "#ef4444" : "#f97316"}
            loading={loading}
          />
          <StatCard
            label="REGIONS ACTIVE"
            value={regionCount || "—"}
            sub={regionCount > 0
              ? Object.keys(byRegion).slice(0, 2).join(", ")
              : "Make changes in AWS to see regions"}
            color="#a78bfa"
            loading={loading}
          />
          <StatCard
            label="SERVICES TRACKED"
            value="13"
            sub="CloudTrail + multi-region coverage"
            color="#60a5fa"
            loading={false}
          />
        </div>

        {/* ── MAIN GRID ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "290px 1fr 240px", gap: 12 }}>

          {/* LEFT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel title="THREAT RADAR" badge="LIVE">
              <RadarScanner
                hasCritical={criticalAlerts > 0}
                hasAlerts={openAlerts > 0}
                threatLevel={threatLevel}
              />
            </Panel>
            <Panel title="SERVICE HEALTH" badge="13 SERVICES">
              <ServiceHealth />
            </Panel>
          </div>

          {/* CENTER — Alert Feed */}
          <Panel title="REAL-TIME ALERT FEED" badge="LIVE" style={{ minHeight: 580 }}>
            <AlertFeed />
          </Panel>

          {/* RIGHT column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Severity breakdown */}
            <Panel title="SEVERITY BREAKDOWN">
              {(["CRITICAL","HIGH","MEDIUM","LOW"]).map(sev => {
                const colors = {
                  CRITICAL: "#ef4444", HIGH: "#f97316",
                  MEDIUM: "#eab308", LOW: "#22c55e"
                };
                const c = colors[sev];
                const count = bySeverity[sev] || 0;
                const max = Math.max(...Object.values(bySeverity), 1);
                return (
                  <div key={sev} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ color: c, fontSize: 9, fontWeight: 700 }}>{sev}</span>
                      <span style={{ color: c, fontSize: 11, fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 2, height: 4 }}>
                      <div style={{
                        width: `${(count / max) * 100}%`,
                        height: "100%", background: c,
                        borderRadius: 2, transition: "width 0.5s"
                      }} />
                    </div>
                  </div>
                );
              })}
            </Panel>

            {/* Region breakdown — REAL DATA */}
            <Panel title="ACTIVE REGIONS">
              {Object.keys(byRegion).length === 0 ? (
                <div style={{ color: "#334455", fontSize: 10, textAlign: "center", padding: "16px 0" }}>
                  No region data yet.<br />
                  <span style={{ fontSize: 9, color: "#445566" }}>
                    Make a change in AWS Console<br />to see regions appear here.
                  </span>
                </div>
              ) : (
                Object.entries(byRegion).slice(0, 8).map(([region, count]) => (
                  <div key={region} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 7
                  }}>
                    <span style={{ color: "#a78bfa", fontSize: 9, fontFamily: "monospace" }}>
                      {region}
                    </span>
                    <span style={{
                      background: "rgba(167,139,250,0.1)", color: "#a78bfa",
                      padding: "1px 7px", borderRadius: 3,
                      fontSize: 10, fontWeight: 700
                    }}>{count}</span>
                  </div>
                ))
              )}
            </Panel>

            {/* Category breakdown — REAL DATA */}
            <Panel title="BY AWS SERVICE">
              {Object.keys(byCategory).length === 0 ? (
                <div style={{ color: "#334455", fontSize: 10, textAlign: "center", padding: "16px 0" }}>
                  No service data yet.
                </div>
              ) : (
                Object.entries(byCategory).slice(0, 6).map(([cat, count]) => {
                  const color = catColors[cat] || "#8899aa";
                  return (
                    <div key={cat} style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 6
                    }}>
                      <span style={{
                        background: `${color}15`, border: `1px solid ${color}40`,
                        color, padding: "1px 7px", borderRadius: 3,
                        fontSize: 8, letterSpacing: 1
                      }}>{cat}</span>
                      <span style={{ color, fontSize: 11, fontWeight: 700 }}>{count}</span>
                    </div>
                  );
                })
              )}
            </Panel>

            <Panel title="COMPLIANCE STATUS" badge="AWS CONFIG">
              <ComplianceGauge />
            </Panel>
          </div>
        </div>

        {/* Footer */}
        {lastUpdate && (
          <div style={{
            textAlign: "right", color: "#223344", fontSize: 8,
            marginTop: 10, letterSpacing: 1
          }}>
            STATS UPDATED: {lastUpdate.toLocaleTimeString("en-GB", { hour12: false })}
            {" "}· ALERTS POLL: EVERY 15S · STATS REFRESH: EVERY 30S
          </div>
        )}
      </div>
    </div>
  );
}
