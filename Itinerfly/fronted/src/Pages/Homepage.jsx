// ============================================================
// Pages/HomePage.jsx
// Los datos vienen del backend via useFlights hook.
// Los filtros se pasan directamente al hook que llama al backend.
// ============================================================

import React, { useState } from "react";
import { useFlights } from "../hooks/useFlights";
import FlightTable from "../components/flights/FlightTable";
import FlightDetail from "../components/flights/FlightDetail";

const LEGEND = [
  ["A tiempo",      "status-ON_TIME"],
  ["Atrasado",      "status-DELAYED"],
  ["En embarque",   "status-BOARDING"],
  ["Último llamado","status-LAST_CALL"],
  ["Cerrado",       "status-CLOSED"],
  ["En vuelo",      "status-IN_FLIGHT"],
  ["Aterrizado",    "status-LANDED"],
  ["Cancelado",     "status-CANCELLED"],
];

export default function HomePage() {
  const [mode,     setMode]     = useState("departures");
  const [selected, setSelected] = useState(null);
  const [filtros,  setFiltros]  = useState({
    date:           new Date().toISOString().split("T")[0],
    type:           "all",
    airline:        "all",
    search:         "",
    locationSearch: "",
  });

  // Hook conectado al backend — se recarga automáticamente
  // cada vez que cambian mode o filtros
  const { flights, loading, error, recargar } = useFlights(mode, {
    date:   filtros.date,
    type:   filtros.type,
    airline: filtros.airline,
    search: filtros.search || filtros.locationSearch,
  });

  return (
    <div className="page">
      <h1 className="page__title">Itinerario de Vuelos — JFK</h1>
      <p className="page__subtitle">Haz clic en un vuelo para ver los detalles completos.</p>

      {/* Salidas / Llegadas */}
      <div className="mode-bar">
        <div className="mode-toggle">
          {[["departures","🛫","Salidas"],["arrivals","🛬","Llegadas"]].map(([id,icon,label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`mode-btn${mode === id ? " active" : ""}`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <button
          onClick={recargar}
          disabled={loading}
          style={{
            padding: "6px 14px", borderRadius: "6px",
            border: "1px solid #e3e8ff", background: "#fff",
            fontSize: "12px", color: "#1a237e",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Cargando..." : "↻ Actualizar"}
        </button>

        <div className="realtime-indicator">
          <div className="realtime-dot" />
          {loading ? "Consultando backend..." : "Backend conectado ✓"}
        </div>
      </div>

      {/* Error de conexión */}
      {error && (
        <div style={{
          padding: "12px 16px", background: "#ffebee",
          border: "1px solid #ef9a9a", borderRadius: "8px",
          marginBottom: "16px", fontSize: "13px", color: "#b71c1c",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button
            onClick={recargar}
            style={{
              marginLeft: "auto", padding: "4px 10px",
              borderRadius: "4px", border: "1px solid #ef9a9a",
              background: "transparent", color: "#b71c1c",
              cursor: "pointer", fontSize: "12px",
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="table-card">
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#90a4ae" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>✈</div>
            <div style={{ fontSize: "14px" }}>Consultando vuelos desde el backend...</div>
          </div>
        ) : (
          <FlightTable
            flights={flights}
            mode={mode}
            onFlightClick={setSelected}
            filtros={filtros}
            onFiltrosChange={setFiltros}
          />
        )}
      </div>

      {/* Leyenda IATA */}
      <div className="legend-card">
        <div className="legend-title">ESTADOS IATA AIDM</div>
        <div className="legend-row">
          {LEGEND.map(([label, cls]) => (
            <span key={label} className={`status-badge ${cls}`}>{label}</span>
          ))}
        </div>
      </div>

      {selected && (
        <FlightDetail flight={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
