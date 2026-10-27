export default function AlertPanel({ alerts }: { alerts: string[] }) {
  return (
    <div className="alert-panel">
      {alerts.map((a, i) => (
        <div key={i} className="alert-item">
          <span style={{ color: "var(--red)" }}>●</span>
          <span>{a}</span>
        </div>
      ))}
    </div>
  );
}