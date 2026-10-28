import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import SimulatorConfig from "./pages/SimulatorConfig";
import Strategies from "./pages/Strategies";
import Results from "./pages/Results";
import BrotesVariantes from "./pages/BrotesVariantes";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/mapa" element={<MapPage />} />
        <Route path="/simulador" element={<SimulatorConfig />} />
        <Route path="/estrategias" element={<Strategies />} />
        <Route path="/resultados" element={<ErrorBoundary><Results /></ErrorBoundary>} />
<Route path="/brotes" element={<BrotesVariantes />} />
      </Routes>
    </Layout>
  );
}
