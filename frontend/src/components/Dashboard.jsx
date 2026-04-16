import { useState, useEffect, useRef } from "react";
import AlertFeed from "./AlertFeed";
import ComplianceGauge from "./ComplianceGauge";
import ServiceHealth from "./ServiceHealth";
import RadarScanner from "./RadarScanner";
import MetricCard from "./MetricCard";

const MOCK_STATS = {
  totalEvents: 48291,
  criticalAlerts: 7,
  complianceScore: 91,
  servicesMonitored: 13,
};

export default function Dashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [activeTab, setActiveTab] = useState("overview");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [threatLevel, setThreatLevel] = useState("MODERATE");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setStats((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + Math.floor(Math.random() * 5),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const tabs = ["overview", "alerts", "compliance", "analytics"];

  return (
    <div className="dashboard-root">
      {/* Animated Background Grid */}
      <div className="bg-grid" />
      <div className="bg-scanline" />

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">
            <div className="logo-hex">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <polygon
                  points="18,2 32,10 32,26 18,34 4,26 4,10"
                  fill="none"
                  stroke="#00d4aa"
                  strokeWidth="1.5"
                />
                <polygon
                  points="18,8 27,13 27,23 18,28 9,23 9,13"
                  fill="#00d4aa"
                  opacity="0.15"
                  stroke="#00d4aa"
                  strokeWidth="0.5"
                />
                <text
                  x="18"
                  y="22"
                  textAnchor="middle"
                  fill="#00d4aa"
                  fontSize="10"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  CS
                </text>
              </svg>
            </div>
          </div>
          <div>
            <h1 className="logo-title">CLOUD SEEKER</h1>
            <p className="logo-sub">AWS Security Intelligence Platform</p>
          </div>
        </div>

        <nav className="nav-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`nav-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <div className={`threat-badge threat-${threatLevel.toLowerCase()}`}>
            <span className="threat-dot" />
            THREAT: {threatLevel}
          </div>
          <div className="clock">
            <div className="clock-time">
              {currentTime.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="clock-date">
              {currentTime.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Metric Cards Row */}
        <div className="metrics-row">
          <MetricCard
            label="TOTAL EVENTS"
            value={stats.totalEvents.toLocaleString()}
            delta="+124 last hour"
            color="teal"
            icon="⬡"
          />
          <MetricCard
            label="CRITICAL ALERTS"
            value={stats.criticalAlerts}
            delta="2 unresolved"
            color="red"
            icon="⚠"
          />
          <MetricCard
            label="COMPLIANCE SCORE"
            value={`${stats.complianceScore}%`}
            delta="+3% this week"
            color="green"
            icon="✦"
          />
          <MetricCard
            label="SERVICES ACTIVE"
            value={stats.servicesMonitored}
            delta="All healthy"
            color="blue"
            icon="◈"
          />
        </div>

        {/* Main Grid */}
        <div className="main-grid">
          {/* Left: Radar + Service Health */}
          <div className="left-col">
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">THREAT RADAR</span>
                <span className="panel-badge live">● LIVE</span>
              </div>
              <RadarScanner />
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">SERVICE HEALTH</span>
                <span className="panel-badge">13 SERVICES</span>
              </div>
              <ServiceHealth />
            </div>
          </div>

          {/* Center: Alert Feed */}
          <div className="center-col">
            <div className="panel panel-tall">
              <div className="panel-header">
                <span className="panel-title">REAL-TIME ALERT FEED</span>
                <span className="panel-badge live">● STREAMING</span>
              </div>
              <AlertFeed />
            </div>
          </div>

          {/* Right: Compliance */}
          <div className="right-col">
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">COMPLIANCE STATUS</span>
                <span className="panel-badge">AWS CONFIG</span>
              </div>
              <ComplianceGauge />
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">ARCHITECTURE FLOW</span>
              </div>
              <ArchitectureFlow />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ArchitectureFlow() {
  const nodes = [
    { id: "ct", label: "CloudTrail", color: "#f59e0b", x: 50 },
    { id: "s3", label: "S3", color: "#3b82f6", x: 50 },
    { id: "eb", label: "EventBridge", color: "#8b5cf6", x: 50 },
    { id: "sf", label: "Step Fn", color: "#06b6d4", x: 50 },
    { id: "λ", label: "Lambda", color: "#00d4aa", x: 50 },
    { id: "db", label: "DynamoDB", color: "#f59e0b", x: 50 },
    { id: "gw", label: "API Gateway", color: "#ec4899", x: 50 },
  ];

  return (
    <div className="arch-flow">
      {nodes.map((node, i) => (
        <div key={node.id} className="arch-node-row">
          <div className="arch-node" style={{ borderColor: node.color }}>
            <span className="arch-dot" style={{ background: node.color }} />
            <span className="arch-label">{node.label}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="arch-arrow">
              <div className="arch-line" style={{ background: node.color }} />
              <span className="arch-chevron">▼</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
