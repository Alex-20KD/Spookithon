import { NavLink } from "react-router-dom";
import { Map, Settings2, Shield, AlertTriangle, BarChart3, LayoutDashboard } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/mapa", label: "Mapa Epidemiológico", icon: Map },
  { to: "/simulador", label: "Simulador", icon: Settings2 },
  { to: "/estrategias", label: "Estrategias", icon: Shield },
  { to: "/resultados", label: "Resultados", icon: BarChart3 },
  { to: "/brote", label: "Brote Sorpresa", icon: AlertTriangle },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-dot" />
        PLAGA ZERO
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink key={it.to} to={it.to} end={it.to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <Icon size={18} />
            {it.label}
          </NavLink>
        );
      })}
      <div style={{ marginTop: 24, fontSize: 11, color: "var(--muted)" }}>
        Demo epidemiológica ficticia · Manta, Ecuador
      </div>
    </aside>
  );
}