/** Doble de prueba de src/claude.js. Misma forma y mismo parseo, sin red. */
import { interpretarRespuesta } from '../src/claude-formato.js'
let respuesta = 'respuesta de prueba'
let extra = {}
let error = null
let activo = true
let ultima = null

export const claudeActivo = () => activo
export const preciosSinLlenar = () => false

export async function redactarConClaude ({ historial = [], nombre = '', instruccion = '' }) {
  ultima = { historial, nombre, instruccion }
  if (error) throw new Error(error)
  return { ...interpretarRespuesta(respuesta), uso: null, ...extra }
}

// ---- controles para las pruebas ----
export function __responder (texto, opciones = {}) {
  respuesta = texto
  extra = opciones
  error = null
}
export function __fallar (mensaje) { error = mensaje }
export function __apagarClaude () { activo = false }
export function __ultimaLlamada () { return ultima }
export function __reset () {
  respuesta = 'respuesta de prueba'
  extra = {}
  error = null
  activo = true
  ultima = null
}
