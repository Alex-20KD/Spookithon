import { useEffect, useMemo, useState } from "react";
import { obtenerCatalogo } from "../services/apiClient";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";
import { useSimulation } from "../context/SimulationContext";
import PageTitle from "../components/ui/PageTitle";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import MetricCard from "../components/ui/MetricCard";
import EventsPanel from "../components/EventsPanel";
import BrotesEditor from "../components/BrotesEditor";
import type { CatalogoResponse } from "../types/api";
import CurveTooltip from "../components/charts/CurveTooltip";
import { nombreAmigable } from "../utils/estrategias";
import type { ResultadoEstrategia } from "../types/api";

const num = (n: number) => Math.round(n).toLocaleString("es-EC");

/** Construye los puntos de la curva con la banda p10-p90 para recharts. */
function datosCurva(e: ResultadoEstrategia) {
  const { dias, media, p10, p90 } = e.curva_diaria;
  return dias.map((d, i) => ({
    dia: d,
    media: media[i],
    p10: p10[i],
    // El área apilada dibuja la banda: base p10 + grosor (p90 - p10).
    banda: Math.max(0, (p90[i] ?? 0) - (p10[i] ?? 0)),
    p90: p90[i],
  }));
}

export default function Results() {
  const { resultado, cargando, error, brotes, setBrotes, comparar, cargarTrayectoria, params, meta, trayectoria } = useSimulation();
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  const [estrategiaSel, setEstrategiaSel] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    obtenerCatalogo(ctrl.signal).then(setCatalogo).catch(() => setCatalogo(null));
    return () => ctrl.abort();
  }, []);

  const estrategias = resultado?.estrategias ?? [];

  const seleccionada = useMemo(() => {
    const lista = resultado?.estrategias ?? [];
    if (lista.length === 0) return null;
    const porNombre = lista.find((e) => e.nombre === estrategiaSel);
    return (
      porNombre ??
      lista.find((e) => e.nombre === resultado?.mejor_estrategia) ??
      lista[0]
    );
  }, [resultado, estrategiaSel]);

  const curva = seleccionada ? datosCurva(seleccionada) : [];

  const variantesData = useMemo(
    () =>
      (trayectoria?.serie_global ?? []).map((p) => ({
        dia: p.dia,
        acechador: p.variantes?.acechador ?? 0,
        chasqueador: p.variantes?.chasqueador ?? 0,
        gordinflon: p.variantes?.gordinflon ?? 0,
        normal: p.variantes?.normal ?? 0,
      })),
    [trayectoria],
  );

  // --- Estados de carga / error / vacío --- //
  if (cargando) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="loading">
            <span className="spinner" aria-hidden="true" /> Ejecutando la simulación en el
            backend…
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="error-box" role="alert">
            <strong>No se pudieron cargar los resultados.</strong>
            <div style={{ marginTop: 4 }}>{error}</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div>
        <Cabecera />
        <Card>
          <div className="empty">
            Aún no hay resultados. Ve a{" "}
            <Link to="/simulador">Configuración del Simulador</Link> y pulsa{" "}
            <strong>“Comparar estrategias”</strong>.
          </div>
        </Card>
      </div>
    );
  }

  const nada = estrategias.find((e) => e.nombre === "Nada");
  const mejor = estrategias.find((e) => e.nombre === resultado.mejor_estrategia);
  const salvadasMejor = mejor ? mejor.salvados_media : 0;

  return (
    <div>
      <Cabecera />

      <Card title="Escenario y brotes">
        <BrotesEditor
          brotes={brotes}
          onChange={setBrotes}
          catalogo={catalogo}
          diasMax={meta?.topes?.dias_max ?? params.dias}
        />
        <div style={{ marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={async () => {
              const res = await comparar();
              if (res) await cargarTrayectoria();
            }}
            disabled={cargando}
          >
            {cargando ? "Ejecutando análisis…" : "Ejecutar análisis"}
          </button>
        </div>
      </Card>

      <div style={{ height: 16 }} />
      <div className="kpi-row">
        <MetricCard label="Mejor estrategia" value={resultado.mejor_estrategia} color="green" />
        <MetricCard
          label="Infectados (mejor)"
          value={mejor ? num(mejor.infectados_media) : "—"}
          sub="promedio"
          color="red"
        />
        <MetricCard label="Salvados (mejor)" value={num(salvadasMejor)} sub="promedio" color="green" />
        <MetricCard
          label="Sin intervención"
          value={nada ? num(nada.infectados_media) : "—"}
          sub="infectados 'Nada'"
          color="orange"
        />
        <MetricCard label="Corridas" value={resultado.n_corridas} sub={`semilla ${resultado.semilla}`} color="blue" />
      </div>

      <div style={{ height: 16 }} />

      <Card title={`Curva de zombis por día · banda p10–p90 — ${seleccionada?.nombre ?? ""}`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {estrategias.map((e) => (
            <button
              key={e.nombre}
              className={`btn ${seleccionada?.nombre === e.nombre ? "primary" : "ghost"}`}
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => setEstrategiaSel(e.nombre)}
            >
              {nombreAmigable(e.nombre)}
            </button>
          ))}
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={curva}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
              <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
              <Tooltip
                content={<CurveTooltip estrategia={seleccionada?.nombre} />}
                cursor={{ stroke: "#60A5FA", strokeWidth: 1 }}
              />
              <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
              {/* Banda p10–p90: área base invisible (p10) + grosor (p90-p10). */}
              <Area
                type="monotone"
                dataKey="p10"
                stackId="banda"
                stroke="none"
                fill="transparent"
                name="p10"
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="banda"
                stackId="banda"
                stroke="none"
                fill="rgba(96,165,250,0.20)"
                name="Rango p10–p90"
              />
              <Line type="monotone" dataKey="media" stroke="#FF5263" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: "#FF5263", stroke: "#F1F5F9" }} name="Media" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          La franja azul representa la incertidumbre entre el percentil 10 y el 90 de las{" "}
          {resultado.n_corridas} corridas.
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {trayectoria && (
        <Card title="Variantes de zombis por día">
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={variantesData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="dia" stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                <YAxis stroke="#94A3B8" tick={{ fill: "#CBD5E1", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#1B2938", border: "1px solid #334155", color: "#F1F5F9" }} />
                <Legend wrapperStyle={{ color: "#CBD5E1", fontSize: 12 }} />
                <Line type="monotone" dataKey="acechador" stroke="#FF5263" name="Acechadores" dot={false} />
                <Line type="monotone" dataKey="chasqueador" stroke="#FF7A45" name="Chasqueadores" dot={false} />
                <Line type="monotone" dataKey="gordinflon" stroke="#F2C94C" name="Gordinflones" dot={false} />
                <Line type="monotone" dataKey="normal" stroke="#4DD0E1" name="Zombis comunes" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div style={{ height: 16 }} />
      <Card title="Infectados y salvados por estrategia">
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Estrategia</th>
                <th>Infectados (media)</th>
                <th>Infectados p10–p90</th>
                <th>Salvados (media)</th>
                <th>Salvados p10–p90</th>
                <th>% mejor que Nada</th>
                <th>% mejor que Azar</th>
              </tr>
            </thead>
            <tbody>
              {estrategias.map((e) => {
                const base = e.nombre === "Nada" || e.nombre === "Azar";
                const esMejor = e.nombre === resultado.mejor_estrategia;
                return (
                  <tr key={e.nombre} style={base ? { color: "var(--muted)" } : undefined}>
                    <td>
                      {nombreAmigable(e.nombre)}
                      {esMejor && " ⭐"}
                      {base && (
                        <Pill color="orange">línea base</Pill>
                      )}
                    </td>
                    <td>{num(e.infectados_media)}</td>
                    <td>
                      {num(e.infectados_p10)} – {num(e.infectados_p90)}
                    </td>
                    <td>{num(e.salvados_media)}</td>
                    <td>
                      {num(e.salvados_p10)} – {num(e.salvados_p90)}
                    </td>
                    <td>{e.pct_mejor_que_nada.toFixed(0)}%</td>
                    <td>{e.pct_mejor_que_azar.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          “Nada” (no intervenir) y “Azar” (vacunar al azar) son las dos líneas base de
          comparación.
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Recomendación">
        <div style={{ fontWeight: 700, color: "var(--green)", fontSize: 18, overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {resultado.mejor_estrategia}
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
          {resultado.recomendacion}
        </p>
      </Card>

      <div style={{ height: 16 }} />
      <EventsPanel resultado={resultado} />
    </div>
  );
}

function Cabecera() {
  return (
    <PageTitle
      title="Resultados y Análisis"
      subtitle="Comparación de estrategias calculada por el backend"
      right={<Pill color="orange">DATOS SIMULADOS</Pill>}
    />
  );
}
