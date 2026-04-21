const { describe, it, expect } = require('vitest')
const request = require('supertest')

process.env.USE_MOCK_DATA  = 'true'
process.env.NODE_ENV       = 'test'
process.env.JWT_SECRET     = 'secreto_de_test'
process.env.PORT           = '4001'
process.env.CORS_ORIGIN    = 'http://localhost:3000'
process.env.AIRPORT_ICAO   = 'KJFK'
process.env.AIRPORT_IATA   = 'JFK'
process.env.JWT_EXPIRES_IN = '1h'

const app = require('../../server')

describe('GET /health', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
  })
  it('tiene status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.body.status).toBe('ok')
  })
  it('indica modo MOCK', async () => {
    const res = await request(app).get('/health')
    expect(res.body.mode).toContain('MOCK')
  })
  it('incluye el código del aeropuerto', async () => {
    const res = await request(app).get('/health')
    expect(res.body.airport).toBe('JFK')
  })
})

describe('GET /api/flights/departures', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/api/flights/departures')
    expect(res.status).toBe(200)
  })
  it('devuelve array de vuelos', async () => {
    const res = await request(app).get('/api/flights/departures')
    expect(Array.isArray(res.body.data.flights)).toBe(true)
  })
  it('devuelve modo departures', async () => {
    const res = await request(app).get('/api/flights/departures')
    expect(res.body.data.mode).toBe('departures')
  })
  it('filtra por tipo domestic', async () => {
    const res = await request(app).get('/api/flights/departures?type=domestic')
    expect(res.status).toBe(200)
  })
  it('rechaza fecha inválida', async () => {
    const res = await request(app).get('/api/flights/departures?date=15-10-2024')
    expect(res.status).toBe(400)
  })
  it('rechaza tipo inválido', async () => {
    const res = await request(app).get('/api/flights/departures?type=invalido')
    expect(res.status).toBe(400)
  })
  it('acepta fecha de hoy', async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const res = await request(app).get(`/api/flights/departures?date=${hoy}`)
    expect(res.status).toBe(200)
  })
  it('rechaza fecha pasada', async () => {
    const res = await request(app).get('/api/flights/departures?date=2020-01-01')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/flights/arrivals', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/api/flights/arrivals')
    expect(res.status).toBe(200)
  })
  it('devuelve modo arrivals', async () => {
    const res = await request(app).get('/api/flights/arrivals')
    expect(res.body.data.mode).toBe('arrivals')
  })
  it('rechaza tipo inválido', async () => {
    const res = await request(app).get('/api/flights/arrivals?type=xyz')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/flights/search', () => {
  it('busca London y devuelve 200', async () => {
    const res = await request(app).get('/api/flights/search?q=London')
    expect(res.status).toBe(200)
  })
  it('rechaza query de 1 caracter', async () => {
    const res = await request(app).get('/api/flights/search?q=A')
    expect(res.status).toBe(400)
  })
  it('rechaza sin query', async () => {
    const res = await request(app).get('/api/flights/search')
    expect(res.status).toBe(400)
  })
  it('incluye el query en la respuesta', async () => {
    const res = await request(app).get('/api/flights/search?q=Tokyo')
    expect(res.body.data.query).toBe('Tokyo')
  })
  it('acepta modo arrivals', async () => {
    const res = await request(app).get('/api/flights/search?q=London&mode=arrivals')
    expect(res.body.data.mode).toBe('arrivals')
  })
  it('rechaza modo inválido', async () => {
    const res = await request(app).get('/api/flights/search?q=London&mode=xyz')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/flights/:flightCode', () => {
  it('devuelve 200 para AA101', async () => {
    const res = await request(app).get('/api/flights/AA101')
    expect(res.status).toBe(200)
  })
  it('devuelve datos del vuelo', async () => {
    const res = await request(app).get('/api/flights/AA101')
    expect(res.body.data.flight.flightNumber).toBe('AA101')
  })
  it('devuelve 404 para vuelo inexistente', async () => {
    const res = await request(app).get('/api/flights/XX999')
    expect(res.status).toBe(404)
  })
  it('devuelve 400 para código muy corto', async () => {
    const res = await request(app).get('/api/flights/AB')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/airlines', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/api/airlines')
    expect(res.status).toBe(200)
  })
  it('devuelve array de aerolíneas', async () => {
    const res = await request(app).get('/api/airlines')
    expect(Array.isArray(res.body.data.airlines)).toBe(true)
  })
})

describe('GET /api/routes', () => {
  it('responde 200', async () => {
    const res = await request(app).get('/api/routes')
    expect(res.status).toBe(200)
  })
  it('devuelve array de rutas', async () => {
    const res = await request(app).get('/api/routes')
    expect(Array.isArray(res.body.data.routes)).toBe(true)
  })
  it('todas las rutas parten de JFK', async () => {
    const res = await request(app).get('/api/routes')
    res.body.data.routes.forEach(r => expect(r.from.iata).toBe('JFK'))
  })
})

describe('POST /api/auth/login', () => {
  it('rechaza sin body', async () => {
    const res = await request(app).post('/api/auth/login').send({})
    expect(res.status).toBe(400)
  })
  it('rechaza credenciales incorrectas', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin.jfk', password: 'mala' })
    expect(res.status).toBe(401)
  })
  it('rechaza sin contraseña', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin.jfk' })
    expect(res.status).toBe(400)
  })
})

describe('Rutas inexistentes', () => {
  it('devuelve 404', async () => {
    const res = await request(app).get('/api/ruta-que-no-existe')
    expect(res.status).toBe(404)
  })
  it('success false en 404', async () => {
    const res = await request(app).get('/api/inventado')
    expect(res.body.success).toBe(false)
  })
})
