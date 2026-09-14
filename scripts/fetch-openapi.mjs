// Descarga /v3/api-docs del servidor (requiere login) y lo guarda en api/openapi.json.
// Uso: API_URL=http://localhost:8080 API_USER=admin API_PASS=xxx node scripts/fetch-openapi.mjs
import { writeFileSync } from 'node:fs'

const base = process.env.API_URL ?? 'http://localhost:8080'
const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuario: process.env.API_USER, password: process.env.API_PASS }),
})
if (!login.ok) throw new Error(`Login ${login.status}: revisa API_USER/API_PASS`)
const { token } = await login.json()
const docs = await fetch(`${base}/v3/api-docs`, { headers: { Authorization: `Bearer ${token}` } })
if (!docs.ok) throw new Error(`api-docs ${docs.status}`)
const json = await docs.json()
writeFileSync('api/openapi.json', JSON.stringify(json, null, 2) + '\n')
console.log(`api/openapi.json actualizado: ${Object.keys(json.paths).length} rutas`)
