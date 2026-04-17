/**
 * AlertFeed — REAL data only. Polls /alerts API every 15 seconds.
 * NO fake/demo data. Shows "no alerts yet" when system is quiet.
 */
import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "";

const SEV_CONFIG = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "CRIT" },
  HIGH:     { color: "#f97316", bg: "rgba(249,115,22,0.08)", label: "HIGH" },
  MEDIUM:   { color: "#eab308", bg: "rgba(234,179,8,0.08)",  label: "MED"  },
  LOW:      { color: "#22c55e", bg: "rgba(34,197,94,0.08)",  label: "LOW"  },
};

export default function AlertFeed({ apiUrl }) {
  const url = apiUrl || API;
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [newIds, setNewIds]     = useState(new Set());
  const prevIdsRef              = useRef(new Set());

  const fetchAlerts = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    try {
      const r = await fetch(`${url}/alerts?limit=20&status=OPEN`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const incoming = (data.alerts || []).slice(0, 20);

      // Detect genuinely new arrivals since last poll
      const fresh = new Set(
        incoming
          .filter(a => !prevIdsRef.current.has(a.alert_id))
          .map(a => a.alert_id)
      );
      if (fresh.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 2000);
      }
      prevIdsRef.current = new Set(incoming.map(a => a.alert_id));
      setAlerts(incoming);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn("AlertFeed fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 15000);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  /* ── Empty states ─────────────────────────────────────────────────────── */
  if (!url) {
    return (
      <div className="feed-empty">
        <div className="feed-empty-icon">⚙</div>
        <p>REACT_APP_API_URL not set</p>
        <span>Add it to frontend/.env and redeploy</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="feed-empty">
        <div className="feed-spinner" />
        <span>Connecting to AWS...</span>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="feed-empty">
        <div className="feed-empty-icon" style={{ color: "#22c55e" }}>✓</div>
        <p style={{ color: "#22c55e" }}>ALL CLEAR</p>
        <span>No open alerts. System is secure.</span>
        <span className="feed-refresh-hint">
          Refreshes every 15s
          {lastRefresh && ` · Last: ${lastRefresh.toLocaleTimeString()}`}
        </span>
      </div>
    );
  }

  return (
    <div className="alert-feed">
      <div className="feed-status-bar">
        <span className="feed-count">{alerts.length} open alert{alerts.length !== 1 ? "s" : ""}</span>
        {lastRefresh && (
          <span className="feed-ts">
            Updated {lastRefresh.toLocaleTimeString("en-US", { hour12: false })}
          </span>
        )}
      </div>

      {alerts.map((alert) => {
        const sev = alert.severity || "MEDIUM";
        const cfg = SEV_CONFIG[sev] || SEV_CONFIG.MEDIUM;
        const isNew = newIds.has(alert.alert_id);
        const region = alert.region || alert.awsRegion || "—";
        const service = (alert.event_source || "AWS").replace(".amazonaws.com", "");
        const time = alert.event_time
          ? new Date(alert.event_time).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
          : "—";

        return (
          <div
            key={alert.alert_id}
            className={`alert-item ${isNew ? "alert-new" : ""}`}
            style={{ borderLeftColor: cfg.color, background: cfg.bg }}
          >
            <div className="alert-row">
              <span className="alert-badge" style={{ background: cfg.color }}>
                {cfg.label}
              </span>
              <span className="alert-title">{alert.event_name || "Security Event"}</span>
              <span className="alert-time">{time}</span>
            </div>
            <div className="alert-desc">
              {alert.reason || alert.event_name}
            </div>
            <div className="alert-meta">
              <span className="alert-service">{service}</span>
              <span className="alert-region">{region}</span>
              {alert.user && alert.user !== "unknown" && (
                <span className="alert-region" style={{ color: "#4a7a8a" }}>
                  {alert.user.split("/").pop()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
