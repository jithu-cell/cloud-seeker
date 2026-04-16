import { useState, useEffect, useRef } from "react";

const ALERT_TEMPLATES = [
  {
    type: "CRITICAL",
    title: "Unauthorized Root Access",
    desc: "Root login detected from IP 203.0.113.42",
    service: "CloudTrail",
    region: "us-east-1",
  },
  {
    type: "HIGH",
    title: "S3 Bucket Policy Changed",
    desc: "Public read enabled on bucket prod-data-2024",
    service: "S3",
    region: "us-west-2",
  },
  {
    type: "MEDIUM",
    title: "IAM Role Policy Modified",
    desc: "Admin permissions granted to role lambda-executor",
    service: "IAM",
    region: "global",
  },
  {
    type: "HIGH",
    title: "Unusual API Call Pattern",
    desc: "DescribeInstances called 847 times in 60s",
    service: "EC2",
    region: "eu-west-1",
  },
  {
    type: "LOW",
    title: "CloudWatch Alarm Triggered",
    desc: "CPU utilization exceeded 90% threshold",
    service: "CloudWatch",
    region: "ap-southeast-1",
  },
  {
    type: "CRITICAL",
    title: "Security Group Rule Added",
    desc: "Inbound 0.0.0.0/0 on port 22 (SSH) added",
    service: "EC2",
    region: "us-east-1",
  },
  {
    type: "MEDIUM",
    title: "KMS Key Disabled",
    desc: "Encryption key arn:aws:kms:...:key/abc123 disabled",
    service: "KMS",
    region: "us-east-2",
  },
  {
    type: "HIGH",
    title: "GuardDuty Finding",
    desc: "Cryptocurrency mining activity detected",
    service: "GuardDuty",
    region: "us-west-1",
  },
  {
    type: "LOW",
    title: "Config Rule Non-Compliant",
    desc: "EBS volumes not encrypted in us-east-1",
    service: "AWS Config",
    region: "us-east-1",
  },
  {
    type: "MEDIUM",
    title: "VPC Flow Log Anomaly",
    desc: "High volume traffic to known malicious IP",
    service: "VPC",
    region: "eu-central-1",
  },
];

const TYPE_CONFIG = {
  CRITICAL: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "CRIT" },
  HIGH: { color: "#f97316", bg: "rgba(249,115,22,0.08)", label: "HIGH" },
  MEDIUM: { color: "#eab308", bg: "rgba(234,179,8,0.08)", label: "MED" },
  LOW: { color: "#22c55e", bg: "rgba(34,197,94,0.08)", label: "LOW" },
};

let alertIdCounter = 1;

function makeAlert() {
  const template =
    ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
  return {
    id: alertIdCounter++,
    ...template,
    timestamp: new Date(),
    isNew: true,
  };
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState(() =>
    Array.from({ length: 6 }, makeAlert).map((a) => ({ ...a, isNew: false }))
  );
  const feedRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const newAlert = makeAlert();
      setAlerts((prev) => [newAlert, ...prev.slice(0, 19)]);
      setTimeout(() => {
        setAlerts((prev) =>
          prev.map((a) => (a.id === newAlert.id ? { ...a, isNew: false } : a))
        );
      }, 800);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="alert-feed" ref={feedRef}>
      {alerts.map((alert) => {
        const cfg = TYPE_CONFIG[alert.type];
        return (
          <div
            key={alert.id}
            className={`alert-item ${alert.isNew ? "alert-new" : ""}`}
            style={{ borderLeftColor: cfg.color, background: cfg.bg }}
          >
            <div className="alert-row">
              <span className="alert-badge" style={{ background: cfg.color }}>
                {cfg.label}
              </span>
              <span className="alert-title">{alert.title}</span>
              <span className="alert-time">
                {alert.timestamp.toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <div className="alert-desc">{alert.desc}</div>
            <div className="alert-meta">
              <span className="alert-service">{alert.service}</span>
              <span className="alert-region">{alert.region}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
