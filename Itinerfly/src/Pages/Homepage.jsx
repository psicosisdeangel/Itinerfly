import React, { useState } from "react";
import { DEPARTURES, ARRIVALS } from "../data/mockData";
import FlightTable from "../components/flights/FlightTable";
import FlightDetail from "../components/flights/FlightDetail";

const LEGEND = [
  ["A tiempo","status-ON_TIME"],["Atrasado","status-DELAYED"],["En embarque","status-BOARDING"],
  ["Último llamado","status-LAST_CALL"],["Cerrado","status-CLOSED"],["En vuelo","status-IN_FLIGHT"],
  ["Aterrizado","status-LANDED"],["Cancelado","status-CANCELLED"]
];

export default function HomePage() {
  const [mode, setMode] = useState("departures");
  const [selected, setSelected] = useState(null);
  return (
    <div className="page">
      <h1 className="page__title">Itinerario de Vuelos — JFK</h1>
      <p className="page__subtitle">Haz clic en un vuelo para ver los detalles completos.</p>
      <div className="mode-bar">
        <div className="mode-toggle">
          {[["departures","🌐","Salidas"],["arrivals","🌐","Llegadas"]].map(([id,icon,label])=>(
            <button key={id} onClick={()=>setMode(id)} className={`mode-btn${mode===id?" active":""}`}>{icon} {label}</button>
          ))}
        </div>
        <div className="realtime-indicator">
          <div className="realtime-dot"/>
          Conectar WebSocket para tiempo real
        </div>
      </div>
      <div className="table-card">
        <FlightTable flights={mode==="departures"?DEPARTURES:ARRIVALS} mode={mode} onFlightClick={setSelected}/>
      </div>
      <div className="legend-card">
        <div className="legend-title">ESTADOS IATA AIDM</div>
        <div className="legend-row">
          {LEGEND.map(([label,cls])=><span key={label} className={`status-badge ${cls}`}>{label}</span>)}
        </div>
      </div>
      {selected && <FlightDetail flight={selected} onClose={()=>setSelected(null)}/>}
    </div>
  );
}
