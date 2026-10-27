import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { DailyPoint } from "../../types";

export default function DailyEvolutionChart({ data }: { data: DailyPoint[] }) {
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#263746" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#8B9BB0" />
          <YAxis stroke="#8B9BB0" />
          <Tooltip contentStyle={{ background: "#16222E", border: "1px solid #263746", color: "#E6EDF3" }} />
          <Legend />
          <Line type="monotone" dataKey="sanos" stroke="#38E89A" strokeWidth={2} dot={false} name="Sanos" />
          <Line type="monotone" dataKey="incubando" stroke="#FF7A45" strokeWidth={2} dot={false} name="Incubando" />
          <Line type="monotone" dataKey="portadores" stroke="#4DA8FF" strokeWidth={2} dot={false} name="Portadores" />
          <Line type="monotone" dataKey="zombis" stroke="#FF4D5A" strokeWidth={2} dot={false} name="Zombis" />
          <Line type="monotone" dataKey="inmunes" stroke="#8B9BB0" strokeWidth={2} dot={false} name="Inmunes" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}