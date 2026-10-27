import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import SimulatorConfig from "./pages/SimulatorConfig";
import Strategies from "./pages/Strategies";
import Results from "./pages/Results";
import { Navigate } from "react-router-dom";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/simulador" element={<SimulatorConfig />} />
        <Route path="/estrategias" element={<Strategies />} />
        <Route path="/resultados" element={<Results />} />
        <Route path="/brote" element={<Navigate to="/simulador" replace />} />
      </Routes>
    </Layout>
  );
}
