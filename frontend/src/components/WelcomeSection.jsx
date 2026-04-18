/**
 * WelcomeSection.jsx
 * Shows on the ANALYTICS tab.
 * Fetches /users and /stats from your real API.
 * Displays:
 *   - Welcome greeting with first IAM username
 *   - Total user count
 *   - Active regions bar chart
 *   - Recent console logins with IPs
 *   - "How it works" pipeline row
 */

import { useState, useEffect } from "react";

// ── Tiny bar chart component ──────────────────────────────────────────────────
function RegionBar({ region, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const colors = {
    "eu-north-1": "#00d4aa", "us-east-1": "#3b82f6",
    "us-west-2": "#8b5cf6",  "eu-west-1": "#f59e0b",
    "ap-southeast-1": "#ec4899", "us-east-2": "#22c55e",
  };
  const color = colors[region] || "#6b9a9b";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#e2f0ee" }}>{region}</span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: color, fontWeight: 700 }}>
          {count} events
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,.04)", borderRadius: 3 }}>
        <div style={{
          height: "100%", borderRadius: 3, background: color,
          width: "0%", transition: "width 1s cubic-bezier(.4,0,.2,1)",
        }}
        ref={el => { if (el) setTimeout(() => el.style.width = pct + "%", 100) }}
        />
      </div>
    </div>
  );
}

// ── Pipeline step ─────────────────────────────────────────────────────────────
function PipeStep({ icon, label, desc, color }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 8,
        border: `1px solid ${color}44`, background: `${color}10`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 6px", fontSize: 18,
      }}>{icon}</div>
      <div style={{ fontFamily: "monospace", fontSize: 9, color: color, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontSize: 9, color: "#3d6567", marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
    </div>
  );
}

function PipeArrow() {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingBottom: 20, flexShrink: 0 }}>
      <div style={{ width: 20, height: 1, background: "rgba(0,212,170,.2)" }} />
      <div style={{ fontSize: 8, color: "rgba(0,212,170,.4)" }}>▶</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN WELCOME SECTION
// ═════════════════════════════════════════════════════════════════════════════
export default function WelcomeSection({ apiBase }) {
  const [userData,  setUserData]  = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (!apiBase) { setLoading(false); return; }

    Promise.all([
      fetch(`${apiBase}/users`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${apiBase}/stats`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([users, stats]) => {
      setUserData(users);
      setStatsData(stats);
      setLoading(false);
    }).catch(e => {
      setError(e.message);
      setLoading(false);
    });
  }, [apiBase]);

  // ── Derive display values ──────────────────────────────────────────────────
  const firstName = userData?.users?.[0]?.UserName
    || userData?.recentLogins?.[0]?.user?.split("/").pop()
    || "Admin";

  const totalUsers = userData?.totalUsers ?? "—";

  const regionData = statsData?.byRegion
    ? Object.entries(statsData.byRegion)
    : [["eu-north-1", 0]];
  const maxRegionCount = Math.max(...regionData.map(([,c]) => c), 1);

  const recentLogins = userData?.recentLogins ?? [];

  const SEV_COLOR = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e" };

  return (
    <div style={{ padding: "0 0 24px" }}>

      {/* ── Welcome banner ──────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(0,212,170,.06) 0%, rgba(59,130,246,.04) 100%)",
        border: "1px solid rgba(0,212,170,.15)", borderRadius: 8,
        padding: "20px 24px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#3d6567", letterSpacing: 2, marginBottom: 4 }}>
            ANALYTICS DASHBOARD
          </div>
          <h2 style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 700, color: "#00d4aa", margin: 0 }}>
            Welcome back, {loading ? "..." : firstName}
          </h2>
          <p style={{ fontSize: 11, color: "#6b9a9b", margin: "4px 0 0" }}>
            Monitoring your AWS environment across all regions in real time
          </p>
        </div>

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "IAM Users",      value: totalUsers,                    color: "#3b82f6" },
            { label: "Active Regions", value: regionData.filter(([,c])=>c>0).length, color: "#00d4aa" },
            { label: "Total Events",   value: (statsData?.totalAlerts ?? "—"), color: "#8b5cf6" },
            { label: "Open Alerts",    value: (statsData?.openAlerts  ?? "—"), color: "#ef4444" },
          ].map(p => (
            <div key={p.label} style={{
              background: `${p.color}10`, border: `1px solid ${p.color}33`,
              borderRadius: 6, padding: "8px 14px", textAlign: "center", minWidth: 70,
            }}>
              <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: p.color }}>
                {p.value}
              </div>
              <div style={{ fontSize: 9, color: p.color, opacity: .7, letterSpacing: 1, marginTop: 1 }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#3d6567", fontFamily: "monospace", fontSize: 11 }}>
          Loading analytics data...
        </div>
      )}

      {error && (
        <div style={{
          background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.2)",
          borderRadius: 6, padding: 12, marginBottom: 16, fontFamily: "monospace", fontSize: 10, color: "#ef4444",
        }}>
          API error: {error} — Check REACT_APP_API_URL in Amplify environment variables
        </div>
      )}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>

          {/* ── Active regions chart ─────────────────────────────────────── */}
          <div style={{
            background: "rgba(6,16,24,.9)", border: "1px solid rgba(0,212,170,.1)",
            borderRadius: 8, overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid rgba(0,212,170,.08)",
              background: "rgba(0,212,170,.02)",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00d4aa", letterSpacing: 3, fontWeight: 700 }}>
                ACTIVE REGIONS
              </span>
            </div>
            <div style={{ padding: 14 }}>
              {regionData.length === 0 ? (
                <div style={{ color: "#3d6567", fontSize: 10, fontFamily: "monospace" }}>No region data yet</div>
              ) : (
                regionData.slice(0, 8).map(([region, count]) => (
                  <RegionBar key={region} region={region} count={count} max={maxRegionCount} />
                ))
              )}
            </div>
          </div>

          {/* ── Recent console logins ────────────────────────────────────── */}
          <div style={{
            background: "rgba(6,16,24,.9)", border: "1px solid rgba(0,212,170,.1)",
            borderRadius: 8, overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 12px", borderBottom: "1px solid rgba(0,212,170,.08)",
              background: "rgba(0,212,170,.02)",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00d4aa", letterSpacing: 3, fontWeight: 700 }}>
                RECENT CONSOLE LOGINS
              </span>
            </div>
            <div style={{ padding: "6px 8px" }}>
              {recentLogins.length === 0 ? (
                <div style={{ color: "#3d6567", fontSize: 10, fontFamily: "monospace", padding: 8 }}>
                  No recent login data — Console logins appear here after CloudTrail captures them
                </div>
              ) : (
                recentLogins.map((login, i) => {
                  const sc = SEV_COLOR[login.severity] || "#22c55e";
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 6px", borderBottom: i < recentLogins.length - 1
                        ? "1px solid rgba(255,255,255,.03)" : "none",
                    }}>
                      <span style={{
                        fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                        color: "#000", background: sc, padding: "1px 4px", borderRadius: 2, flexShrink: 0,
                      }}>
                        {login.severity === "CRITICAL" ? "ROOT" : "IAM"}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#e2f0ee",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {(login.user || "unknown").split("/").pop()}
                        </div>
                        <div style={{ fontSize: 9, color: "#3d6567" }}>IP: {login.source_ip}</div>
                      </div>
                      <div style={{ fontSize: 9, color: "#3d6567", fontFamily: "monospace", flexShrink: 0 }}>
                        {login.event_time
                          ? new Date(login.event_time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Severity breakdown ──────────────────────────────────────────────── */}
      {statsData?.bySeverity && (
        <div style={{
          background: "rgba(6,16,24,.9)", border: "1px solid rgba(0,212,170,.1)",
          borderRadius: 8, overflow: "hidden", marginBottom: 12,
        }}>
          <div style={{
            padding: "8px 12px", borderBottom: "1px solid rgba(0,212,170,.08)",
            background: "rgba(0,212,170,.02)",
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00d4aa", letterSpacing: 3, fontWeight: 700 }}>
              ALERT BREAKDOWN BY SEVERITY
            </span>
          </div>
          <div style={{ padding: 14, display: "flex", gap: 12 }}>
            {[["CRITICAL","#ef4444"],["HIGH","#f97316"],["MEDIUM","#eab308"],["LOW","#22c55e"]].map(([sev, color]) => (
              <div key={sev} style={{
                flex: 1, background: `${color}08`, border: `1px solid ${color}25`,
                borderRadius: 6, padding: "10px", textAlign: "center",
              }}>
                <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color }}>
                  {statsData.bySeverity[sev] ?? 0}
                </div>
                <div style={{ fontSize: 8, color, opacity: .8, letterSpacing: 1, marginTop: 2 }}>{sev}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── How it works pipeline ─────────────────────────────────────────── */}
      <div style={{
        background: "rgba(6,16,24,.9)", border: "1px solid rgba(0,212,170,.1)",
        borderRadius: 8, overflow: "hidden",
      }}>
        <div style={{
          padding: "8px 12px", borderBottom: "1px solid rgba(0,212,170,.08)",
          background: "rgba(0,212,170,.02)",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#00d4aa", letterSpacing: 3, fontWeight: 700 }}>
            HOW IT WORKS — DETECTION PIPELINE
          </span>
        </div>
        <div style={{ padding: "16px 12px", display: "flex", alignItems: "flex-start", overflowX: "auto" }}>
          <PipeStep icon="☁️" label="AWS ACTION" desc="You do something in AWS Console" color="#00d4aa" />
          <PipeArrow />
          <PipeStep icon="📋" label="CLOUDTRAIL" desc="Records the API call" color="#3b82f6" />
          <PipeArrow />
          <PipeStep icon="⚡" label="EVENTBRIDGE" desc="Detects event in ~30 seconds" color="#8b5cf6" />
          <PipeArrow />
          <PipeStep icon="λ" label="LAMBDA" desc="Analyzes + scores threat" color="#f59e0b" />
          <PipeArrow />
          <PipeStep icon="🗄️" label="DYNAMODB" desc="Stores alert record" color="#06b6d4" />
          <PipeArrow />
          <PipeStep icon="📧" label="SNS EMAIL" desc="Sends to your Gmail" color="#ec4899" />
          <PipeArrow />
          <PipeStep icon="📊" label="DASHBOARD" desc="Shows in real time" color="#00d4aa" />
        </div>
      </div>
    </div>
  );
}
