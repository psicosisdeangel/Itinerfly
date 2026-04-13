import React, { useState, useMemo } from "react";
import { AIRLINES } from "../../data/mockData";
import FlightStatusBadge from "./FlightStatusBadge";
import FlightFilters from "./FlightFilters";

const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:false}) : "—";
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("es-ES",{day:"2-digit",month:"short"}) : "—";

export default function FlightTable({ flights, onFlightClick, mode }) {
  const today = new Date().toISOString().split("T")[0];
  const [filters, setFilters] = useState({date:today, type:"all", airline:"all", locationSearch:""});
  const [flightSearch, setFlightSearch] = useState("");
  const airlineMap = useMemo(()=>Object.fromEntries(AIRLINES.map((a)=>[a.id,a])),[]);

  const filtered = useMemo(()=>flights.filter((f)=>{
    const fd = new Date(f.scheduledOut).toISOString().split("T")[0];
    if (filters.date && fd!==filters.date) return false;
    if (filters.type!=="all" && f.type!==filters.type) return false;
    if (filters.airline!=="all" && f.airline!==filters.airline) return false;
    if (flightSearch && !f.flightNumber.toUpperCase().includes(flightSearch.toUpperCase())) return false;
    if (filters.locationSearch) {
      const q=filters.locationSearch.toLowerCase();
      const loc=mode==="departures"?f.destination:f.origin;
      if (!loc.city?.toLowerCase().includes(q)&&!loc.country?.toLowerCase().includes(q)&&!loc.iata?.toLowerCase().includes(q)) return false;
    }
    return true;
  }),[flights,filters,flightSearch,mode]);

  return (
    <div>
      <div className="search-row">
        <div className="flight-search-wrap">
          <span className="flight-search-icon">✈</span>
          <input className="flight-search-input" type="text" placeholder="Número de vuelo (ej: AA101)"
            value={flightSearch} onChange={(e)=>setFlightSearch(e.target.value)} />
        </div>
        {flightSearch && <button className="clear-btn" onClick={()=>setFlightSearch("")}>Limpiar</button>}
      </div>
      <FlightFilters filters={filters} onChange={setFilters} />
      <div style={{overflowX:"auto"}}>
        <table className="flights-table">
          <thead>
            <tr>
              {["Vuelo","Aerolínea",mode==="departures"?"Destino":"Origen","Programado","Estimado","Puerta","Terminal","Estado"].map((h)=>(
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 ? (
              <tr><td colSpan={8} className="table-empty">No se encontraron vuelos con los filtros seleccionados.</td></tr>
            ) : filtered.map((f,i)=>{
              const al=airlineMap[f.airline];
              const loc=mode==="departures"?f.destination:f.origin;
              return (
                <tr key={f.id} className={`flight-row ${i%2===0?"even":"odd"}`} onClick={()=>onFlightClick&&onFlightClick(f)}>
                  <td><span className="flight-number">{f.flightNumber}</span></td>
                  <td><span className="airline-name">{al?.name||f.airline}</span></td>
                  <td>
                    <div className="flight-iata">{loc.iata}</div>
                    <div className="flight-city">{loc.city}, {loc.country}</div>
                  </td>
                  <td>
                    <div className="flight-time">{fmtTime(f.scheduledOut)}</div>
                    <div className="flight-date">{fmtDate(f.scheduledOut)}</div>
                  </td>
                  <td>
                    <div className={`flight-time${f.delayMinutes>0?" delayed":""}`}>{fmtTime(f.estimatedOut)}</div>
                    {f.delayMinutes>0 && <div className="flight-delay">+{f.delayMinutes} min</div>}
                  </td>
                  <td><span className="gate-badge">{f.gate}</span></td>
                  <td><span className="terminal-text">{f.terminal}</span></td>
                  <td><FlightStatusBadge status={f.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="table-count">Mostrando {filtered.length} de {flights.length} vuelos</div>
    </div>
  );
}
