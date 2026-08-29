/**
 * Panel de control del dueño.
 *
 * Todo se maneja desde el celular: escribes los comandos en tu chat
 * "Mensajes contigo mismo" (o desde el número que pongas en WA_DUENIO)
 * y el bot obedece. Nunca decide nada por su cuenta si estás en modo
 * "aprobacion".
 */
import { config } from './config.js'
import { store } from './store.js'
import { claudeActivo, preciosSinLlenar } from './claude.js'

const PREFIJOS = ['.', '/', '!']

export const MENU = `📋 *PANEL RASTERIZAR*

*Modo de trabajo*
.modo aprobacion — redacto y te pido permiso
.modo auto — respondo solo
.modo manual — solo te aviso, no respondo

*Control rápido*
.on — activar el bot
.off — apagar el bot (nadie recibe respuesta)
.estado — ver cómo está todo

*Que Claude cotice*
.cotiza 51987654321 — relee ese chat y redacta
.cotiza 51987654321 | agrégale instalación y 10% dscto

*Por cliente*
.pausa 51987654321 120 — callar ese chat 120 min
.reanudar 51987654321 — volver a atender ese chat
.enviar 51987654321 | tu mensaje

*Cuando te pido permiso*
Responde al aviso con:
  ok — enviar tal cual
  no — descartar
  cualquier otro texto — lo envío corregido así
También sirve: .ok a3 / .no a3 / .ok a3 texto corregido

.menu — ver esto de nuevo`

/** ¿El texto es un comando del panel? */
export function esComando (texto = '') {
  return PREFIJOS.includes(texto.trim()[0])
}

const jidDe = (numero) => `${String(numero).replace(/\D/g, '')}@s.whatsapp.net`
const numeroDe = (jid = '') => jid.split('@')[0].split(':')[0]

function resumenEstado () {
  const e = store.get()
  const pausados = Object.entries(e.pausados)
    .filter(([, hasta]) => hasta > Date.now())
    .map(([jid, hasta]) => `  • ${numeroDe(jid)} (${Math.ceil((hasta - Date.now()) / 60000)} min)`)
  const pendientes = Object.entries(e.pendientes)
    .map(([id, p]) => `  • #${id} — ${numeroDe(p.jid)}: ${(p.consulta || "").slice(0, 40)}`)

  return [
    '📊 *ESTADO*',
    '',
    `Bot: ${e.encendido ? '🟢 encendido' : '🔴 apagado'}`,
    `Modo: *${e.modo}*`,
    `Número: ${config.numero}`,
    `Redacta: ${claudeActivo() ? `🤖 Claude (${config.claude.modelo})` : '📄 plantillas fijas'}`,
    ...(claudeActivo() && preciosSinLlenar()
      ? ['⚠️ *negocio/precios.md está sin llenar* — Claude no podrá cotizar cifras']
      : []),
    '',
    `Chats en pausa: ${pausados.length || 'ninguno'}`,
    ...pausados,
    '',
    `Borradores esperándote: ${pendientes.length || 'ninguno'}`,
    ...pendientes
  ].join('\n')
}

/**
 * Procesa un comando del dueño.
 * @returns {Promise<{respuesta?: string, enviar?: {jid: string, texto: string}}>}
 */
export async function ejecutarComando (texto) {
  const limpio = texto.trim().slice(1)          // quita el prefijo
  const [cmdRaw, ...resto] = limpio.split(/\s+/)
  const cmd = cmdRaw.toLowerCase()
  const args = resto.join(' ').trim()

  switch (cmd) {
    case 'menu':
    case 'ayuda':
    case 'help':
      return { respuesta: MENU }

    case 'estado':
    case 'status':
      return { respuesta: resumenEstado() }

    case 'on':
    case 'encender':
      store.set({ encendido: true })
      return { respuesta: '🟢 Bot encendido.' }

    case 'off':
    case 'apagar':
      store.set({ encendido: false })
      return { respuesta: '🔴 Bot apagado. No se responderá a nadie hasta que envíes *.on*' }

    case 'modo': {
      const m = args.toLowerCase()
      if (!['auto', 'aprobacion', 'manual'].includes(m)) {
        return { respuesta: 'Modos válidos: *auto*, *aprobacion*, *manual*' }
      }
      store.set({ modo: m })
      const explica = {
        auto: 'Respondo solo a los clientes.',
        aprobacion: 'Redacto y te pido permiso antes de enviar.',
        manual: 'Solo te aviso de los mensajes; no respondo nada.'
      }
      return { respuesta: `✅ Modo *${m}*. ${explica[m]}` }
    }

    case 'pausa': {
      const [numero, min] = args.split(/\s+/)
      if (!numero) return { respuesta: 'Uso: *.pausa 51987654321 120*' }
      const minutos = Number(min) || config.pausaMin
      store.pausar(jidDe(numero), minutos)
      return { respuesta: `🔇 ${numero} en silencio por ${minutos} min.` }
    }

    case 'reanudar': {
      if (!args) return { respuesta: 'Uso: *.reanudar 51987654321*' }
      store.reanudar(jidDe(args.split(/\s+/)[0]))
      return { respuesta: `🔊 ${args} vuelve a atenderse automáticamente.` }
    }

    case 'enviar': {
      const [numero, ...msg] = args.split('|')
      const cuerpo = msg.join('|').trim()
      if (!numero?.trim() || !cuerpo) {
        return { respuesta: 'Uso: *.enviar 51987654321 | Buenos días, le escribo de Rasterizar...*' }
      }
      // Si escribes tú, tomas el control de ese chat: el bot se aparta
      const destino = jidDe(numero)
      store.pausar(destino, config.pausaMin)
      return {
        enviar: { jid: destino, texto: cuerpo },
        respuesta: `📤 Enviado a ${numeroDe(destino)}. Ese chat queda para ti ${config.pausaMin} min (*.reanudar ${numeroDe(destino)}* para devolvérselo al bot).`
      }
    }

    case 'ok':
    case 'si': {
      const [id, ...correccion] = args.split(/\s+/)
      const p = store.tomarPendiente(id)
      if (!p) return { respuesta: `No encuentro el borrador #${id}. Envía *.estado* para ver los pendientes.` }
      const cuerpo = correccion.join(' ').trim() || p.texto
      return { enviar: { jid: p.jid, texto: cuerpo }, respuesta: `✅ Enviado a ${numeroDe(p.jid)}` }
    }

    case 'no': {
      const id = args.split(/\s+/)[0]
      const p = store.tomarPendiente(id)
      if (!p) return { respuesta: `No encuentro el borrador #${id}.` }
      store.pausar(p.jid, config.pausaMin)
      return { respuesta: `🗑️ Borrador #${id} descartado. ${numeroDe(p.jid)} queda en pausa ${config.pausaMin} min para que respondas tú.` }
    }

    default:
      return { respuesta: `No conozco el comando *${cmd}*.\n\n${MENU}` }
  }
}

/**
 * Respuesta del dueño citando un borrador ("ok", "no" o el texto corregido).
 * @param {string} idBorrador  id corto del borrador citado
 * @param {string} texto       lo que escribió el dueño
 */
export function resolverCitado (idBorrador, texto) {
  const p = store.verPendiente(idBorrador)
  if (!p) return null

  const t = texto.trim()
  const tl = t.toLowerCase()

  if (['ok', 'si', 'sí', 'dale', 'envia', 'envía', 'enviar', 'ya', 'listo', '👍', '✅'].includes(tl)) {
    store.tomarPendiente(idBorrador)
    return { enviar: { jid: p.jid, texto: p.texto }, respuesta: `✅ Enviado a ${numeroDe(p.jid)}` }
  }

  if (['no', 'nel', 'descarta', 'descartar', 'cancela', 'cancelar', '❌'].includes(tl)) {
    store.tomarPendiente(idBorrador)
    store.pausar(p.jid, config.pausaMin)
    return { respuesta: `🗑️ Descartado. ${numeroDe(p.jid)} en pausa ${config.pausaMin} min.` }
  }

  // Cualquier otro texto = corrección del dueño, se envía eso
  store.tomarPendiente(idBorrador)
  return { enviar: { jid: p.jid, texto: t }, respuesta: `✏️ Enviado con tu corrección a ${numeroDe(p.jid)}` }
}

export { jidDe, numeroDe }
