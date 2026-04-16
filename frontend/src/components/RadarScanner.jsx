import { useEffect, useRef, useState } from "react";

const THREAT_BLIPS = [
  { angle: 42, dist: 0.45, type: "critical", label: "RootAccess" },
  { angle: 115, dist: 0.7, type: "high", label: "S3Breach" },
  { angle: 230, dist: 0.35, type: "medium", label: "IAMChange" },
  { angle: 310, dist: 0.6, type: "low", label: "CPUSpike" },
  { angle: 78, dist: 0.82, type: "high", label: "GuardDuty" },
  { angle: 190, dist: 0.55, type: "medium", label: "VPCAnomaly" },
];

const BLIP_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function RadarScanner() {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const rafRef = useRef(null);
  const trailsRef = useRef([]);
  const [hoveredBlip, setHoveredBlip] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 8;

    // Blip positions in canvas coords
    const blips = THREAT_BLIPS.map((b) => ({
      ...b,
      x: cx + Math.cos((b.angle * Math.PI) / 180) * b.dist * R,
      y: cy + Math.sin((b.angle * Math.PI) / 180) * b.dist * R,
      visible: false,
      brightness: 0,
    }));

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Dark background circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,12,20,0.85)";
      ctx.fill();

      // Concentric rings
      [0.25, 0.5, 0.75, 1].forEach((scale) => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * scale, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,212,170,0.12)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Cross-hairs
      ctx.strokeStyle = "rgba(0,212,170,0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();

      // Sweep trail
      const sweepAngle = angleRef.current;
      const trailLength = (45 * Math.PI) / 180;
      const gradient = ctx.createConicalGradient
        ? null
        : null;

      // Draw sweep fade using multiple arcs
      for (let i = 0; i < 20; i++) {
        const alpha = (1 - i / 20) * 0.18;
        const startAngle = sweepAngle - trailLength * (i / 20);
        const endAngle = sweepAngle - trailLength * ((i + 1) / 20);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, startAngle, endAngle, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,212,170,${alpha})`;
        ctx.fill();
      }

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(sweepAngle) * R,
        cy + Math.sin(sweepAngle) * R
      );
      ctx.strokeStyle = "rgba(0,212,170,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Check which blips are lit
      blips.forEach((blip) => {
        const blipAngle = (blip.angle * Math.PI) / 180;
        let diff = ((sweepAngle - blipAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.08) {
          blip.visible = true;
          blip.brightness = 1.0;
        } else {
          blip.brightness = Math.max(0, blip.brightness - 0.008);
          if (blip.brightness < 0.05) blip.visible = false;
        }
      });

      // Draw blips
      blips.forEach((blip) => {
        if (blip.brightness < 0.05) return;
        const color = BLIP_COLORS[blip.type];
        const alpha = blip.brightness;

        // Outer ring
        ctx.beginPath();
        ctx.arc(blip.x, blip.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle =
          color + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(blip.x, blip.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle =
          color + Math.round(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();

        // Label
        if (alpha > 0.3) {
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
          ctx.font = "9px monospace";
          ctx.fillText(blip.label, blip.x + 9, blip.y + 3);
        }
      });

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00d4aa";
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,212,170,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();

      angleRef.current += 0.018;
      if (angleRef.current > Math.PI * 2) angleRef.current -= Math.PI * 2;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="radar-wrap">
      <canvas ref={canvasRef} width={220} height={220} className="radar-canvas" />
      <div className="radar-legend">
        {Object.entries(BLIP_COLORS).map(([type, color]) => (
          <div key={type} className="radar-legend-item">
            <span className="radar-legend-dot" style={{ background: color }} />
            <span className="radar-legend-label">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
