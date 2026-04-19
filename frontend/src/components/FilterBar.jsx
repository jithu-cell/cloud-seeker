/**
 * FilterBar.jsx — Animated pill filter buttons
 * Replaces the plain .filter-btn divs in the Alerts tab.
 *
 * Usage:
 *   <FilterBar
 *     filter={filter}
 *     counts={counts}
 *     onFilter={setFilter}
 *     onRefresh={fetchAlerts}
 *   />
 */

import { useState } from "react";

// Color config for each severity level
const SEV_CFG = {
  ALL:      { label: "All",      color: "#6366F1", hover: "rgba(99,102,241,.4)",  shadow: "rgba(99,102,241,.35)"  },
  CRITICAL: { label: "Critical", color: "#EF4444", hover: "rgba(239,68,68,.4)",   shadow: "rgba(239,68,68,.35)"   },
  HIGH:     { label: "High",     color: "#F59E0B", hover: "rgba(245,158,11,.4)",  shadow: "rgba(245,158,11,.35)"  },
  MEDIUM:   { label: "Medium",   color: "#D97706", hover: "rgba(217,119,6,.35)",  shadow: "rgba(217,119,6,.3)"    },
  LOW:      { label: "Low",      color: "#22C55E", hover: "rgba(34,197,94,.4)",   shadow: "rgba(34,197,94,.35)"   },
};

function PillBtn({ id, label, count, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  const cfg = SEV_CFG[id];
  const lit = isActive || hovered;

  return (
    <button
      className={`pill-btn${isActive ? " pill-btn-active" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        /* Active or hovered: colored glow + lift */
        background: lit
          ? `linear-gradient(135deg, #0f172a 0%, #0f172a 100%)`
          : "#0f172a",
        boxShadow: lit
          ? `0 15px 24px ${cfg.shadow}, 0 4px 8px rgba(0,0,0,.3)`
          : "0 4px 10px rgba(0,0,0,.2)",
        transform: lit ? "translateY(-5px)" : "translateY(0)",
        borderColor: lit ? cfg.color + "55" : "rgba(255,255,255,.08)",
        color: lit ? cfg.color : "#94A3B8",
      }}
    >
      {/* Active/hover colored underline glow */}
      <span
        className="pill-btn-glow"
        style={{
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          opacity: lit ? 1 : 0,
        }}
      />

      {/* Dot indicator for active severity */}
      {isActive && id !== "ALL" && (
        <span
          className="pill-btn-dot"
          style={{
            background: cfg.color,
            boxShadow: `0 0 5px ${cfg.color}`,
          }}
        />
      )}

      <span className="pill-btn-label">{label}</span>

      {/* Count badge */}
      {count > 0 && (
        <span
          className="pill-btn-count"
          style={{
            background: lit ? cfg.color + "22" : "rgba(255,255,255,.05)",
            color: lit ? cfg.color : "#4B6280",
            borderColor: lit ? cfg.color + "33" : "rgba(255,255,255,.06)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function FilterBar({ filter, counts, onFilter, onRefresh }) {
  const [refreshSpin, setRefreshSpin] = useState(false);

  const handleRefresh = () => {
    setRefreshSpin(true);
    onRefresh?.();
    setTimeout(() => setRefreshSpin(false), 800);
  };

  return (
    <div className="filter-bar-new">
      {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((f) => (
        <PillBtn
          key={f}
          id={f}
          label={SEV_CFG[f].label}
          count={counts[f] ?? 0}
          isActive={filter === f}
          onClick={() => onFilter(f)}
        />
      ))}

      {/* Refresh button — right-aligned */}
      <button
        className="refresh-pill"
        onClick={handleRefresh}
        title="Refresh alerts"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform .8s ease",
            transform: refreshSpin ? "rotate(360deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Refresh
      </button>
    </div>
  );
}
