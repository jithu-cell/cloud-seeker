export default function MetricCard({ label, value, delta, color, icon }) {
  const colorMap = {
    teal: "#00d4aa",
    red: "#ef4444",
    green: "#22c55e",
    blue: "#3b82f6",
  };
  const c = colorMap[color] || "#00d4aa";

  return (
    <div className="metric-card" style={{ borderTopColor: c }}>
      <div className="metric-top">
        <span className="metric-icon" style={{ color: c }}>
          {icon}
        </span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value" style={{ color: c }}>
        {value}
      </div>
      <div className="metric-delta">{delta}</div>
    </div>
  );
}
