const colors: Record<string, string> = {
  green: "#38E89A",
  red: "#FF5263",
  orange: "#FF7A45",
  blue: "#4DA8FF",
  muted: "#94A3B8",
};

export default function MetricCard({
  label,
  value,
  sub,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: keyof typeof colors;
}) {
  const c = colors[color] || colors.blue;
  return (
    <div className="metric-card">
      <div className="glow" style={{ background: c }} />
      <div className="label">{label}</div>
      <div className="value" style={{ color: c, overflowWrap: "anywhere", wordBreak: "break-word" }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}