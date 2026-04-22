const axios  = require("axios");
const config = require("../config");
const mock   = require("../mock/flightData");

// ── Detectar vuelo doméstico por código ICAO ─────────────────
// Aeropuertos USA: empiezan con K, P, TJ, PA, PH
function esDomestico(origin, destination) {
  const esUSA = (icao) => {
    if (!icao) return false;
    const c = icao.toUpperCase();
    return c.startsWith("K") || c.startsWith("PA") || c.startsWith("PH") || c.startsWith("TJ");
  };
  const origIcao = origin?.icao  || origin?.code  || "";
  const destIcao = destination?.icao || destination?.code || "";
  // Si tenemos country_code, usarlo primero (más confiable)
  if (origin?.country_code && destination?.country_code) {
    return origin.country_code === "US" && destination.country_code === "US";
  }
  return esUSA(origIcao) && esUSA(destIcao);
}

// ── Cliente HTTP FlightAware ─────────────────────────────────
const faClient = axios.create({
  baseURL: config.flightAware.baseUrl,
  timeout: 15000,
  headers: { "x-apikey": config.flightAware.apiKey, "Accept": "application/json" },
});

faClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const s = err.response?.status;
    const m = err.response?.data?.detail || err.message;
    if (s === 401) throw new Error("FlightAware: API Key inválida.");
    if (s === 403) throw new Error("FlightAware: Sin permiso.");
    if (s === 429) throw new Error("FlightAware: Límite de peticiones alcanzado.");
    throw new Error(`FlightAware error ${s}: ${m}`);
  }
);

// ── Normalización ────────────────────────────────────────────
function normalizarVuelo(f) {
  const orig = f.origin      || {};
  const dest = f.destination || {};
  const schedOut = f.scheduled_out || f.scheduled_off;
  const estOut   = f.estimated_out || f.estimated_off || schedOut;
  const schedIn  = f.scheduled_in  || f.scheduled_on;
  const estIn    = f.estimated_in  || f.estimated_on  || schedIn;

  const originNorm = {
    iata:         orig.code_iata   || orig.code || "",
    icao:         orig.code        || "",
    city:         orig.city        || "",
    country:      orig.country     || "",
    country_code: orig.country_code || "",
  };
  const destNorm = {
    iata:         dest.code_iata   || dest.code || "",
    icao:         dest.code        || "",
    city:         dest.city        || "",
    country:      dest.country     || "",
    country_code: dest.country_code || "",
  };

  const delay = (() => {
    if (!schedOut || !estOut) return 0;
    return Math.max(0, Math.round((new Date(estOut) - new Date(schedOut)) / 60000));
  })();

  return {
    flightNumber:     f.ident_iata    || f.ident,
    airlineId:        f.operator_iata || (f.ident || "").slice(0, 2),
    origin:           originNorm,
    destination:      destNorm,
    scheduledOut:     schedOut,
    estimatedOut:     estOut,
    actualOut:        f.actual_out  || f.actual_off,
    scheduledIn:      schedIn,
    estimatedIn:      estIn,
    actualIn:         f.actual_in   || f.actual_on,
    status:           traducirEstado(f.status, f.cancelled),
    gate:             f.gate_origin || f.gate_destination || "—",
    terminal:         f.terminal_origin || f.terminal_destination || "—",
    aircraft:         f.aircraft_type || "—",
    type:             esDomestico(originNorm, destNorm) ? "domestic" : "international",
    delayMinutes:     delay,
    registration:     f.registration || "—",
    callsign:         f.ident        || "—",
    cruiseAltitudeFt: f.filed_altitude,
    cruiseSpeedKts:   f.filed_speed,
  };
}

function traducirEstado(estado, cancelado) {
  if (cancelado) return "CANCELLED";
  return { "Scheduled":"ON_TIME","En Route":"IN_FLIGHT","Landed":"LANDED","Cancelled":"CANCELLED","Diverted":"DELAYED" }[estado] || "ON_TIME";
}

// ── Construir rango de fechas para FlightAware ───────────────
// FlightAware limita: máximo 2 días en el futuro desde ahora
// Para "hoy" → últimas 6h + próximas 18h
// Para "mañana" y "pasado" → ese día completo (solo si está dentro del límite)
function construirRango(date) {
  try {
    const ahora = new Date();
    let inicioFinal, finFinal;

    if (!date) {
      // Caso 1: Sin fecha (Hoy)
      inicioFinal = new Date(ahora.getTime() - 6 * 60 * 60 * 1000);
      finFinal = new Date(ahora.getTime() + 12 * 60 * 60 * 1000);
    } else {
      // Caso 2: Con fecha específica
      const partes = date.split("-");
      if (partes.length !== 3) throw new Error("Formato de fecha inválido");

      const [year, month, day] = partes.map(Number);
      
      // Usar UTC para evitar desfases
      const inicioDia = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const finDia = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

      const limiteMax = new Date(ahora.getTime() + 47 * 60 * 60 * 1000);
      finFinal = finDia > limiteMax ? limiteMax : finDia;

      const limiteMin = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
      inicioFinal = inicioDia < limiteMin ? limiteMin : inicioDia;
    }

    // Formateador ISO8601 estricto (sin milisegundos)
    const formatFA = (d) => d.toISOString().split('.')[0] + 'Z';

    // EL RETURN DEBE ESTAR AQUÍ, AL FINAL DE TODO
    return { 
      start: formatFA(inicioFinal), 
      end: formatFA(finFinal) 
    };

  } catch (err) {
    // Si algo falla, retornamos un rango seguro por defecto para que no explote
    console.error("Error en construirRango, usando backup:", err.message);
    const ahora = new Date();
    return {
      start: ahora.toISOString().split('.')[0] + 'Z',
      end: new Date(ahora.getTime() + 3600000).toISOString().split('.')[0] + 'Z'
    };
  }
}

// ── Fecha local de un ISO string ─────────────────────────────
function fechaLocal(iso) {
  if (!iso) return null;
  const d  = new Date(iso);
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── Filtrado en memoria ──────────────────────────────────────
function filtrar(vuelos, opciones, mode) {
  const { date, type, airlineId, search, locationSearch } = opciones;

  // Fechas válidas en hora local
  const hoy = new Date();
  const fechasValidas = [0, 1, 2].map(n => {
    const d = new Date(hoy); d.setDate(hoy.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  });

  return vuelos.filter(f => {
    const fv = fechaLocal(mode === "departures" ? f.scheduledOut : (f.scheduledIn || f.scheduledOut));
    if (!fv || !fechasValidas.includes(fv)) return false;
    if (date && fv !== date) return false;
    if (type && type !== "all" && f.type !== type) return false;
    if (airlineId && airlineId !== "all" && f.airlineId !== airlineId) return false;
    if (search) {
      if (!f.flightNumber?.toUpperCase().includes(search.toUpperCase())) return false;
    }
    if (locationSearch) {
      const q   = locationSearch.toLowerCase().trim();
      const loc = mode === "departures" ? f.destination : f.origin;
      if (!loc?.city?.toLowerCase().includes(q) &&
          !loc?.country?.toLowerCase().includes(q) &&
          !loc?.iata?.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// ============================================================
// API PÚBLICA
// ============================================================

async function getDepartures(opciones = {}) {
  if (config.useMockData) return filtrar(mock.DEPARTURES, opciones, "departures");

  const { start, end } = construirRango(opciones.date);
  const resp = await faClient.get(
    `/airports/${config.airport.icao}/flights/departures`,
    { params: { max_pages: 2, type: "Airline", start, end } }
  );
  const vuelos = (resp.data.departures || []).map(normalizarVuelo);
  return filtrar(vuelos, opciones, "departures");
}

async function getArrivals(opciones = {}) {
  if (config.useMockData) return filtrar(mock.ARRIVALS, opciones, "arrivals");

  const { start, end } = construirRango(opciones.date);
  const resp = await faClient.get(
    `/airports/${config.airport.icao}/flights/arrivals`,
    { params: { max_pages: 2, type: "Airline", start, end } }
  );
  const vuelos = (resp.data.arrivals || []).map(normalizarVuelo);
  return filtrar(vuelos, opciones, "arrivals");
}

async function getFlightByCode(codigo) {
  if (config.useMockData) {
    return [...mock.DEPARTURES, ...mock.ARRIVALS]
      .find(f => f.flightNumber?.toUpperCase() === codigo.toUpperCase()) || null;
  }
  const resp   = await faClient.get(`/flights/${codigo}`);
  const vuelos = resp.data.flights || [];
  if (!vuelos.length) return null;
  return normalizarVuelo(vuelos[0]);
}

async function getAirlines() {
  try {
    // 1. Obtenemos ambos flujos de datos (usando la lógica que ya tienes)
    // Pasamos las mismas opciones (fecha) para que coincidan con la tabla
    const [departures, arrivals] = await Promise.all([
      getDepartures(opciones),
      getArrivals(opciones)
    ]);

    const todosLosVuelos = [...departures, ...arrivals];

    // 2. Extraer aerolíneas únicas usando un Map
    const aerolineasUnicas = new Map();

    todosLosVuelos.forEach(vuelo => {
      // Usamos el airlineId o el código de operador como llave
      const id = vuelo.airlineId; 
      
      // Intentamos obtener el nombre del mock o de los datos del vuelo
      // Si FlightAware no da el nombre completo, buscamos en nuestro catálogo local
      if (id && !aerolineasUnicas.has(id)) {
        const infoMock = mock.AIRLINES.find(a => a.id === id || a.iata === id);
        
        aerolineasUnicas.set(id, {
          id: id,
          iata: id,
          name: infoMock ? infoMock.name : `Airline ${id}`, // Respaldo si no conocemos el nombre
          terminalDep: infoMock?.terminalDep || "—",
          terminalArr: infoMock?.terminalArr || "—"
        });
      }
    });

    // 3. Convertir a Array y ordenar alfabéticamente
    const resultado = Array.from(aerolineasUnicas.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    // Si por alguna razón no hay vuelos, devolvemos el mock para no dejar el filtro vacío
    return resultado.length > 0 ? resultado : mock.AIRLINES;

  } catch (error) {
    console.error("Error extrayendo aerolíneas de vuelos:", error);
    return mock.AIRLINES;
  }
}

async function getRoutes() { return mock.ROUTES; }

async function searchByLocation(query, mode = "departures") {
  const src = mode === "departures" ? mock.DEPARTURES : mock.ARRIVALS;
  const q   = query.toLowerCase().trim();
  return src.filter(f => {
    const loc = mode === "departures" ? f.destination : f.origin;
    return loc?.city?.toLowerCase().includes(q) ||
           loc?.country?.toLowerCase().includes(q) ||
           loc?.iata?.toLowerCase().includes(q);
  });
}

module.exports = { getDepartures, getArrivals, getFlightByCode, getAirlines, getRoutes, searchByLocation };
