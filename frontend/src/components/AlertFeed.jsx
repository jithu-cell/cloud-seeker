/**
 * Cloud Seeker — AlertFeed (REAL DATA VERSION)
 * Polls your actual API Gateway + DynamoDB.
 * Zero fake data — shows ALL CLEAR when no threats exist.
 */

import { useState, useEffect, useCallback } from "react";

// ── Your API URL — set REACT_APP_API_URL in Amplify environment variables ──
const API_BASE = process.env.REACT_APP_API_URL || "";

const SEVERITY_CFG = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "CRIT", border: "#ef4444" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.08)",  label: "HIGH", border: "#f97316" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234,179,8,0.08)",   label: "MED",  border: "#eab308" },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)",   label: "LOW",  border: "#22c55e" },
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function fmtTime(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch { return isoString; }
}

export default function AlertFeed() {
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastUpdate,setLastUpdate]= useState(null);
  const [resolving, setResolving] = useState(new Set());
  const [filter,    setFilter]    = useState("ALL");

  // ── Fetch from real API ────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    if (!API_BASE) {
      setError("REACT_APP_API_URL not set — see setup instructions");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/alerts?limit=50&status=OPEN`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sorted = (data.alerts || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setAlerts(sorted);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(`API error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Poll every 30 seconds for new real alerts
    const interval = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // ── Resolve alert ──────────────────────────────────────────────────────────
  const resolveAlert = async (alertId) => {
    if (!API_BASE) return;
    setResolving(prev => new Set([...prev, alertId]));
    try {
      await fetch(`${API_BASE}/alerts/${alertId}/resolve`, { method: "POST" });
      setAlerts(prev => prev.filter(a => a.alert_id !== alertId));
    } catch (err) {
      console.error("Resolve failed:", err);
    } finally {
      setResolving(prev => { const n = new Set(prev); n.delete(alertId); return n; });
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = filter === "ALL"
    ? alerts
    : alerts.filter(a => a.severity === filter);

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  alerts.forEach(a => { if (counts[a.severity] !== undefined) counts[a.severity]++; });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Count badges + filter */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,212,170,.1)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          {["CRITICAL","HIGH","MEDIUM","LOW"].map(sev => {
            const cfg = SEVERITY_CFG[sev];
            return (
              <div key={sev} style={{
                background: cfg.bg, border: `1px solid ${cfg.color}33`,
                borderRadius: "4px", padding: "4px 10px", textAlign: "center", minWidth: "52px",
              }}>
                <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, color: cfg.color }}>
                  {counts[sev]}
                </div>
                <div style={{ fontSize: "8px", color: cfg.color, letterSpacing: "1px", fontWeight: 700 }}>
                  {sev}
                </div>
              </div>
            );
          })}
          <div style={{
            marginLeft: "auto", background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: "4px",
            padding: "4px 10px", textAlign: "center", minWidth: "40px",
          }}>
            <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, color: "#e2f0ee" }}>
              {alerts.length}
            </div>
            <div style={{ fontSize: "8px", color: "#6b9a9b", letterSpacing: "1px", fontWeight: 700 }}>TOTAL</div>
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          {["ALL","CRITICAL","HIGH","MEDIUM","LOW"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "rgba(0,212,170,.12)" : "none",
              border: `1px solid ${filter === f ? "rgba(0,212,170,.4)" : "rgba(255,255,255,.08)"}`,
              color: filter === f ? "#00d4aa" : "#6b9a9b",
              fontFamily: "monospace", fontSize: "9px", fontWeight: 700,
              padding: "3px 8px", borderRadius: "3px", cursor: "pointer",
              letterSpacing: "1px",
            }}>{f}</button>
          ))}

          <button onClick={fetchAlerts} style={{
            marginLeft: "auto", background: "none",
            border: "1px solid rgba(255,255,255,.08)", color: "#6b9a9b",
            fontFamily: "monospace", fontSize: "9px", padding: "3px 8px",
            borderRadius: "3px", cursor: "pointer",
          }}>↺ REFRESH</button>
        </div>
      </div>

      {/* Status bar */}
      {lastUpdate && (
        <div style={{ padding: "4px 12px", fontSize: "9px", color: "#3d6567",
          fontFamily: "monospace", borderBottom: "1px solid rgba(0,212,170,.06)", flexShrink: 0 }}>
          {filtered.length} open alerts · Updated {fmtTime(lastUpdate.toISOString())}
        </div>
      )}

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#3d6567" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>⟳</div>
            <div style={{ fontFamily: "monospace", fontSize: "11px" }}>Loading alerts from AWS...</div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{
            margin: "12px", padding: "12px", background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.3)", borderRadius: "5px",
          }}>
            <div style={{ color: "#ef4444", fontFamily: "monospace", fontSize: "11px",
              fontWeight: 700, marginBottom: "4px" }}>⚠ API ERROR</div>
            <div style={{ color: "#f97316", fontFamily: "monospace", fontSize: "10px" }}>{error}</div>
            <div style={{ color: "#6b9a9b", fontSize: "10px", marginTop: "6px" }}>
              Check that REACT_APP_API_URL is set in Amplify environment variables.
            </div>
          </div>
        )}

        {/* All clear */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✦</div>
            <div style={{ color: "#22c55e", fontFamily: "monospace", fontSize: "13px",
              fontWeight: 700, letterSpacing: "2px", marginBottom: "4px" }}>ALL CLEAR</div>
            <div style={{ color: "#3d6567", fontSize: "10px" }}>
              {filter === "ALL"
                ? "No open security alerts — your AWS environment looks clean"
                : `No ${filter} severity alerts`}
            </div>
            <div style={{ color: "#3d6567", fontSize: "9px", marginTop: "8px", fontFamily: "monospace" }}>
              Polling every 30s · Last checked: {lastUpdate ? fmtTime(lastUpdate.toISOString()) : "—"}
            </div>
          </div>
        )}

        {/* Real alerts */}
        {!loading && filtered.map(alert => {
          const cfg = SEVERITY_CFG[alert.severity] || SEVERITY_CFG.LOW;
          const isRes = resolving.has(alert.alert_id);
          return (
            <div key={alert.alert_id} style={{
              borderLeft: `2px solid ${cfg.border}`,
              background: cfg.bg,
              borderRadius: "0 5px 5px 0",
              padding: "8px 10px",
              marginBottom: "5px",
              transition: "transform .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateX(2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateX(0)"}
            >
              {/* Row 1: badge + name + resolve + time */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                <span style={{
                  background: cfg.color, color: "#000", fontFamily: "monospace",
                  fontSize: "8px", fontWeight: 700, padding: "1px 5px", borderRadius: "2px", flexShrink: 0,
                }}>{cfg.label}</span>
                <span style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: "12px", fontWeight: 700,
                  color: "#e2f0ee", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{alert.event_name}</span>
                <button
                  onClick={() => resolveAlert(alert.alert_id)}
                  disabled={isRes}
                  style={{
                    background: "none", border: `1px solid ${cfg.color}55`, color: cfg.color,
                    fontFamily: "monospace", fontSize: "8px", fontWeight: 700,
                    padding: "1px 6px", borderRadius: "2px", cursor: "pointer", flexShrink: 0,
                    opacity: isRes ? 0.5 : 1,
                  }}
                >{isRes ? "..." : "RESOLVE"}</button>
                <span style={{ fontFamily: "monospace", fontSize: "9px", color: "#3d6567", flexShrink: 0 }}>
                  {fmtTime(alert.event_time || alert.created_at)}
                </span>
              </div>

              {/* Row 2: reason */}
              <div style={{
                fontSize: "10px", color: "#7a9fa0", marginBottom: "4px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{alert.reason}</div>

              {/* Row 3: metadata tags */}
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {alert.event_source && (
                  <span style={tagStyle}>{alert.event_source.replace(".amazonaws.com", "")}</span>
                )}
                {alert.region && <span style={tagStyle}>{alert.region}</span>}
                {alert.user && (
                  <span style={{...tagStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    {alert.user.split("/").pop()}
                  </span>
                )}
                {alert.source_ip && alert.source_ip !== "unknown" && (
                  <span style={tagStyle}>IP: {alert.source_ip}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const tagStyle = {
  fontFamily: "monospace",
  fontSize: "8px",
  color: "#6b9a9b",
  border: "1px solid rgba(255,255,255,.08)",
  padding: "1px 5px",
  borderRadius: "2px",
};
