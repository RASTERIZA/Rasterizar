import fs from 'node:fs'
import path from 'node:path'

// WA_ESTADO permite usar otro archivo (lo aprovechan las pruebas)
const RUTA = path.resolve(process.env.WA_ESTADO || 'data/estado.json')

const BASE = {
  modo: null,          // se rellena con config.modo la primera vez
  encendido: true,
  pausados: {},        // jid -> timestamp (ms) hasta el que sigue en silencio
  pendientes: {},      // id corto -> { jid, nombre, texto, consulta, ts }
  saludados: {},       // jid -> timestamp del último saludo enviado
  contador: 0
}

let estado = { ...BASE }
let guardando = null

function cargar () {
  try {
    if (fs.existsSync(RUTA)) {
      estado = { ...BASE, ...JSON.parse(fs.readFileSync(RUTA, 'utf8')) }
    }
  } catch (e) {
    console.error('[store] estado.json ilegible, se empieza de cero:', e.message)
    estado = { ...BASE }
  }
  return estado
}

function escribir () {
  try {
    fs.mkdirSync(path.dirname(RUTA), { recursive: true })
    const tmp = `${RUTA}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2))
    fs.renameSync(tmp, RUTA)   // atómico: nunca queda un archivo a medias
  } catch (e) {
    console.error('[store] no se pudo guardar el estado:', e.message)
  }
}

function guardar () {
  // Escritura diferida: agrupa varios cambios seguidos en un solo write
  if (guardando) return
  guardando = setTimeout(() => {
    guardando = null
    escribir()
  }, 250)
  guardando.unref?.()
}

// Si el proceso termina con un cambio sin escribir, se guarda igual
process.on('exit', () => {
  if (guardando) { clearTimeout(guardando); guardando = null; escribir() }
})

cargar()

export const store = {
  get: () => estado,

  /** Cancela la escritura pendiente (lo usan las pruebas al limpiar). */
  detener () {
    if (guardando) { clearTimeout(guardando); guardando = null }
  },

  set (cambios) {
    Object.assign(estado, cambios)
    guardar()
  },

  // ---- pausas por chat -------------------------------------------------
  pausar (jid, minutos) {
    estado.pausados[jid] = Date.now() + minutos * 60_000
    guardar()
  },

  reanudar (jid) {
    delete estado.pausados[jid]
    guardar()
  },

  estaPausado (jid) {
    const hasta = estado.pausados[jid]
    if (!hasta) return false
    if (Date.now() > hasta) {
      delete estado.pausados[jid]
      guardar()
      return false
    }
    return true
  },

  // ---- borradores pendientes de aprobación -----------------------------
  nuevoPendiente (datos) {
    estado.contador = (estado.contador + 1) % 1000
    const id = estado.contador.toString(36)
    estado.pendientes[id] = { ...datos, ts: Date.now() }
    guardar()
    return id
  },

  tomarPendiente (id) {
    const p = estado.pendientes[id]
    if (p) {
      delete estado.pendientes[id]
      guardar()
    }
    return p
  },

  verPendiente: (id) => estado.pendientes[id],

  // Descarta borradores viejos para que no se envíen respuestas fuera de contexto
  limpiarPendientes (horas = 12) {
    const limite = Date.now() - horas * 3_600_000
    let n = 0
    for (const [id, p] of Object.entries(estado.pendientes)) {
      if (p.ts < limite) { delete estado.pendientes[id]; n++ }
    }
    if (n) guardar()
    return n
  },

  // ---- saludo -----------------------------------------------------------
  yaSaludado (jid, horas = 12) {
    const ts = estado.saludados[jid]
    return Boolean(ts) && Date.now() - ts < horas * 3_600_000
  },

  marcarSaludado (jid) {
    estado.saludados[jid] = Date.now()
    guardar()
  }
}
