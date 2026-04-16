import { useEffect, useRef, useState } from "react";

// ──────────────────────────────────────────────
// COMPLIANCE GAUGE
// ──────────────────────────────────────────────
const COMPLIANCE_RULES = [
  { name: "CIS AWS Benchmark", score: 94, total: 100, color: "#00d4aa" },
  { name: "PCI DSS", score: 87, total: 100, color: "#3b82f6" },
  { name: "SOC 2", score: 96, total: 100, color: "#8b5cf6" },
  { name: "HIPAA", score: 89, total: 100, color: "#f59e0b" },
  { name: "NIST 800-53", score: 78, total: 100, color: "#ec4899" },
];

export function ComplianceGauge() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="compliance-list">
      {COMPLIANCE_RULES.map((rule) => {
        const pct = rule.score / rule.total;
        const status = pct >= 0.9 ? "PASS" : pct >= 0.75 ? "WARN" : "FAIL";
        const statusColor =
          status === "PASS" ? "#22c55e" : status === "WARN" ? "#eab308" : "#ef4444";

        return (
          <div key={rule.name} className="compliance-row">
            <div className="compliance-header">
              <span className="compliance-name">{rule.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="compliance-score" style={{ color: rule.color }}>
                  {rule.score}%
                </span>
                <span
                  className="compliance-status"
                  style={{ background: statusColor + "22", color: statusColor }}
                >
                  {status}
                </span>
              </div>
            </div>
            <div className="compliance-bar-track">
              <div
                className="compliance-bar-fill"
                style={{
                  width: animated ? `${pct * 100}%` : "0%",
                  background: rule.color,
                  transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        );
      })}

      <div className="compliance-summary">
        <div className="compliance-summary-item">
          <span className="cs-value" style={{ color: "#22c55e" }}>
            {COMPLIANCE_RULES.filter((r) => r.score >= 90).length}
          </span>
          <span className="cs-label">PASSING</span>
        </div>
        <div className="compliance-summary-divider" />
        <div className="compliance-summary-item">
          <span className="cs-value" style={{ color: "#eab308" }}>
            {COMPLIANCE_RULES.filter((r) => r.score >= 75 && r.score < 90).length}
          </span>
          <span className="cs-label">WARNING</span>
        </div>
        <div className="compliance-summary-divider" />
        <div className="compliance-summary-item">
          <span className="cs-value" style={{ color: "#ef4444" }}>
            {COMPLIANCE_RULES.filter((r) => r.score < 75).length}
          </span>
          <span className="cs-label">FAILING</span>
        </div>
      </div>
    </div>
  );
}

export default ComplianceGauge;

// ──────────────────────────────────────────────
// SERVICE HEALTH
// ──────────────────────────────────────────────
const SERVICES = [
  { name: "CloudTrail", icon: "CT", status: "healthy", latency: 12 },
  { name: "EventBridge", icon: "EB", status: "healthy", latency: 8 },
  { name: "Lambda", icon: "λ", status: "healthy", latency: 234 },
  { name: "DynamoDB", icon: "DB", status: "healthy", latency: 3 },
  { name: "Step Functions", icon: "SF", status: "warning", latency: 1820 },
  { name: "SNS", icon: "SN", status: "healthy", latency: 45 },
  { name: "API Gateway", icon: "AG", status: "healthy", latency: 67 },
  { name: "CloudWatch", icon: "CW", status: "healthy", latency: 22 },
  { name: "AWS Config", icon: "AC", status: "warning", latency: 340 },
  { name: "Amplify", icon: "AM", status: "healthy", latency: 15 },
  { name: "S3", icon: "S3", status: "healthy", latency: 28 },
  { name: "CloudFront", icon: "CF", status: "healthy", latency: 4 },
  { name: "QuickSight", icon: "QS", status: "healthy", latency: 156 },
];

const STATUS_CFG = {
  healthy: { color: "#22c55e", label: "OK" },
  warning: { color: "#eab308", label: "WARN" },
  error: { color: "#ef4444", label: "ERR" },
};

export function ServiceHealth() {
  const [services, setServices] = useState(SERVICES);

  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          latency: Math.max(1, s.latency + Math.floor((Math.random() - 0.5) * 20)),
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="service-grid">
      {services.map((svc) => {
        const cfg = STATUS_CFG[svc.status];
        return (
          <div key={svc.name} className="service-item">
            <div className="service-icon-wrap" style={{ borderColor: cfg.color + "44" }}>
              <span className="service-icon" style={{ color: cfg.color }}>
                {svc.icon}
              </span>
              <span className="service-pulse-dot" style={{ background: cfg.color }} />
            </div>
            <div className="service-info">
              <span className="service-name">{svc.name}</span>
              <span className="service-latency">{svc.latency}ms</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
