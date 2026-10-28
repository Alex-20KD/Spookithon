const num = (n: number) => Math.round(n).toLocaleString("es-EC");

export type CurveTooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: number | string;
  estrategia?: string;
};

export default function CurveTooltip({
  active,
  payload,
  label,
  estrategia,
}: CurveTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const media = payload.find((p) => p.dataKey === "media")?.value ?? 0;
  const p10 = payload.find((p) => p.dataKey === "p10")?.value ?? 0;
  const banda = payload.find((p) => p.dataKey === "banda")?.value ?? 0;
  const p90 = p10 + banda;
  return (
    <div
      style={{
        background: "#1B2938",
        border: "1px solid #334155",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#F1F5F9",
        fontSize: 13,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Día {label}</div>
      {estrategia && <div style={{ color: "#CBD5E1" }}>Estrategia: {estrategia}</div>}
      <div>
        Media de zombis: <strong>{num(Number(media))}</strong>
      </div>
      <div>
        Rango p10–p90: <strong>{num(Number(p10))}</strong> – <strong>{num(Number(p90))}</strong>
      </div>
    </div>
  );
}
