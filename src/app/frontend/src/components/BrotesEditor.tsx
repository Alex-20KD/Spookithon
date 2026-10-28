import { useState } from "react";
import type { CatalogoResponse } from "../types/api";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Pill from "./ui/Pill";

import type { Brote } from "../types/brotes";

export type { Brote };


const TIPOS: { value: Brote["tipo"]; label: string }[] = [
  { value: "brote_inicial", label: "Brote inicial" },
  { value: "brote_secundario", label: "Brote secundario" },
  { value: "zombie_corredor", label: "Zombie corredor" },
  { value: "horda_migratoria", label: "Horda migratoria" },
  { value: "fallo_contencion", label: "Fallo de contención" },
];

interface Props {
  brotes: Brote[];
  onChange: (b: Brote[]) => void;
  catalogo: CatalogoResponse | null;
  diasMax: number;
}

export default function BrotesEditor({ brotes, onChange, catalogo, diasMax }: Props) {
  const [tipo, setTipo] = useState<Brote["tipo"]>("brote_secundario");
  const [dia, setDia] = useState(4);
  const [barrio, setBarrio] = useState("b01");
  const [intensidad, setIntensidad] = useState(5);
  const [duracion, setDuracion] = useState(5);

  const barrios = catalogo?.barrios ?? [];

  const agregar = () => {
    const nuevo: Brote = {
      id: `brote-${Date.now()}`,
      tipo,
      dia: Math.max(0, Math.min(diasMax, dia)),
      barrio_id: barrio,
      intensidad: Math.max(1, intensidad),
      duracion: Math.max(1, duracion),
      activo: true,
    };
    onChange([...brotes, nuevo]);
  };

  const actualizar = (id: string, patch: Partial<Brote>) => {
    onChange(brotes.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const eliminar = (id: string) => {
    onChange(brotes.filter((b) => b.id !== id));
  };

  const ordenados = [...brotes].sort((a, b) => a.dia - b.dia);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card title="Agregar brote">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as Brote["tipo"])} style={selectStyle}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Día</label>
            <input type="number" min={0} max={diasMax} value={dia} onChange={(e) => setDia(Number(e.target.value))} style={selectStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Barrio</label>
            <select value={barrio} onChange={(e) => setBarrio(e.target.value)} style={selectStyle}>
              {barrios.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Intensidad</label>
            <input type="number" min={1} max={50} value={intensidad} onChange={(e) => setIntensidad(Number(e.target.value))} style={selectStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Duración</label>
            <input type="number" min={1} max={30} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} style={selectStyle} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Button variant="primary" onClick={agregar}>
            Agregar brote
          </Button>
        </div>
      </Card>

      <Card title="Brotes programados">
        {brotes.length === 0 && <div className="empty">No hay brotes programados.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ordenados.map((b) => (
            <div key={b.id} className="alert-item" style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{TIPOS.find((t) => t.value === b.tipo)?.label}</strong>
                  <Pill color={b.activo ? "green" : "default"}>{b.activo ? "Activo" : "Inactivo"}</Pill>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Día {b.dia} · {b.barrio_id} · Intensidad {b.intensidad} · Duración {b.duracion}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => actualizar(b.id, { activo: !b.activo })}>
                  {b.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="ghost" onClick={() => eliminar(b.id)}>
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Línea temporal de eventos">
        {ordenados.length === 0 && <div className="empty">Sin eventos.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ordenados.map((b) => (
            <div key={b.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
              <span style={{ minWidth: 40, fontWeight: 700, color: "var(--muted)" }}>Día {b.dia}</span>
              <span style={{ flex: 1 }}>{TIPOS.find((t) => t.value === b.tipo)?.label} · {b.barrio_id}</span>
              <Pill color={b.activo ? "green" : "default"}>{b.activo ? "ON" : "OFF"}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  background: "#0C141D",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};
