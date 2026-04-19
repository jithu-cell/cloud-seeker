/**
 * KpiCard.jsx — Animated glassmorphism metric card
 * Replaces the plain .kpi-card divs in Dashboard.jsx
 *
 * Usage:
 *   <KpiCard
 *     label="Total Events"
 *     value={stats?.totalAlerts ?? "—"}
 *     trend="+6 last hour"
 *     trendType="up"          // "up" | "warn" | "mute"
 *     color="#06B6D4"         // accent color
 *     glowColor="rgba(6,182,212,.45)"
 *     iconPath="M..."         // SVG path d= string
 *     bars={[0.4, 0.7, 0.5, 0.9, 0.6, 0.8]}  // 6 mini bar heights 0–1
 *   />
 */

import { useState, useEffect } from "react";

export default function KpiCard({
  label,
  value,
  trend,
  trendType = "up",
  color = "#6366F1",
  glowColor,
  iconPath,
  bars = [0.3, 0.6, 0.5, 0.8, 0.4, 0.9],
}) {
  const glow = glowColor || color + "44";
  const [hovered, setHovered] = useState(false);
  const [barAnim, setBarAnim] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarAnim(true), 300);
    return () => clearTimeout(t);
  }, []);

  const trendColor =
    trendType === "up" ? "#22C55E" : trendType === "warn" ? "#F59E0B" : "#4B6280";

  return (
    <div
      className="kpi-anim-outer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glow blob behind card */}
      <div
        className="kpi-glow-blob"
        style={{
          background: `radial-gradient(ellipse at center, ${glow}, transparent 70%)`,
          opacity: hovered ? 0.6 : 0.2,
        }}
      />

      {/* Card */}
      <div
        className="kpi-anim-card"
        style={{
          borderColor: hovered ? color + "30" : "rgba(255,255,255,.06)",
        }}
      >
        {/* Top edge shimmer on hover */}
        <div
          className="kpi-shimmer-top"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            opacity: hovered ? 1 : 0,
          }}
        />
        <div
          className="kpi-shimmer-bottom"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
            opacity: hovered ? 1 : 0,
          }}
        />

        {/* Inner content */}
        <div className="kpi-anim-inner">
          {/* Icon + label row */}
          <div className="kpi-anim-top">
            <div className="kpi-anim-icon-wrap">
              {/* Icon glow */}
              <div
                className="kpi-icon-glow"
                style={{
                  background: color + "22",
                  boxShadow: hovered ? `0 0 14px ${color}55` : "none",
                }}
              />
              <div
                className="kpi-anim-icon"
                style={{ background: color + "18", color }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={iconPath} />
                </svg>
              </div>
            </div>

            <div className="kpi-anim-label-area">
              <div className="kpi-anim-label">{label}</div>
              {/* Trend arrow */}
              {trendType === "up" && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22C55E"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: hovered ? "translateY(-2px)" : "translateY(0)",
                    transition: "transform .3s",
                  }}
                >
                  <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
            </div>
          </div>

          {/* Value */}
          <div className="kpi-anim-value" style={{ color }}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
        </div>

        {/* Right: mini bars + trend dot */}
        <div className="kpi-anim-right">
          {/* Mini bar chart */}
          <div className="kpi-mini-bars">
            {bars.map((h, i) => (
              <div key={i} className="kpi-mini-bar-track">
                <div
                  className="kpi-mini-bar-fill"
                  style={{
                    height: barAnim ? `${h * 100}%` : "0%",
                    background: color + (hovered ? "cc" : "77"),
                    transitionDelay: `${i * 0.06}s`,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Trend dot + text */}
          <div className="kpi-anim-trend">
            <div
              className="kpi-trend-dot"
              style={{
                background: trendColor,
                boxShadow: `0 0 6px ${trendColor}`,
              }}
            />
            <span style={{ color: trendColor }}>{trend}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
