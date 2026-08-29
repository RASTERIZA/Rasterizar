/**
 * Memoria de cada conversación.
 *
 * Guarda los últimos mensajes de cada chat para que Claude entienda el hilo:
 * sin esto, cada cotización empezaría de cero y volvería a pedir las medidas
 * que el cliente ya dio.
 */
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'

const RUTA = path.resolve(process.env.WA_HISTORIAL || 'data/historial.json')
const MAX_CHATS = 300
const MAX_LARGO = 4000   // caracteres por mensaje

let chats = {}
let guardando = null

try {
  if (fs.existsSync(RUTA)) chats = JSON.parse(fs.readFileSync(RUTA, 'utf8'))
} catch (e) {
  console.error('[historial] archivo ilegible, se empieza de cero:', e.message)
  chats = {}
}

function escribir () {
  try {
    fs.mkdirSync(path.dirname(RUTA), { recursive: true })
    const tmp = `${RUTA}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(chats))
    fs.renameSync(tmp, RUTA)
  } catch (e) {
    console.error('[historial] no se pudo guardar:', e.message)
  }
}

function guardar () {
  if (guardando) return
  guardando = setTimeout(() => { guardando = null; escribir() }, 500)
  guardando.unref?.()
}

process.on('exit', () => {
  if (guardando) { clearTimeout(guardando); guardando = null; escribir() }
})

/** Deja de crecer: se olvidan los chats que llevan más tiempo sin actividad. */
function podarChats () {
  const jids = Object.keys(chats)
  if (jids.length <= MAX_CHATS) return
  jids
    .sort((a, b) => (chats[a].at(-1)?.ts || 0) - (chats[b].at(-1)?.ts || 0))
    .slice(0, jids.length - MAX_CHATS)
    .forEach(jid => { delete chats[jid] })
}

export const historial = {
  /** Apunta un mensaje. `de` es 'cliente' o 'nosotros'. */
  apuntar (jid, de, texto) {
    if (!jid || !texto) return
    const lista = chats[jid] || (chats[jid] = [])
    lista.push({ de, texto: String(texto).slice(0, MAX_LARGO), ts: Date.now() })
    // Guardamos el doble de lo que se le manda a Claude, por si sube WA_MEMORIA
    const tope = Math.max(40, config.claude.memoria * 2)
    if (lista.length > tope) lista.splice(0, lista.length - tope)
    podarChats()
    guardar()
  },

  /** Los últimos mensajes del chat, del más viejo al más nuevo. */
  leer (jid, cuantos = config.claude.memoria) {
    return (chats[jid] || []).slice(-cuantos).map(({ de, texto }) => ({ de, texto }))
  },

  /** ¿Hay algo del cliente a lo que responder? */
  tieneCliente (jid) {
    return (chats[jid] || []).some(m => m.de === 'cliente')
  },

  olvidar (jid) {
    delete chats[jid]
    guardar()
  },

  detener () {
    if (guardando) { clearTimeout(guardando); guardando = null }
  }
}
