import PageTitle from "../components/ui/PageTitle";
import Pill from "../components/ui/Pill";
import EpidemiologicalMap from "../components/map/EpidemiologicalMap";

export default function MapPage() {
  return (
    <div>
      <PageTitle title="Mapa Epidemiológico" subtitle="Manta, Ecuador · focos simulados" right={<Pill color="orange">DEMO · DATOS SIMULADOS</Pill>} />
      <EpidemiologicalMap />
    </div>
  );
}