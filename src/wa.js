/** Utilidades sobre los mensajes crudos de Baileys. */

/** Quita las envolturas (efímero, ver una vez, etc.) y deja el mensaje real. */
export function desenvolver (message) {
  let m = message
  for (let i = 0; i < 5 && m; i++) {
    if (m.ephemeralMessage) { m = m.ephemeralMessage.message; continue }
    if (m.viewOnceMessage) { m = m.viewOnceMessage.message; continue }
    if (m.viewOnceMessageV2) { m = m.viewOnceMessageV2.message; continue }
    if (m.viewOnceMessageV2Extension) { m = m.viewOnceMessageV2Extension.message; continue }
    if (m.documentWithCaptionMessage) { m = m.documentWithCaptionMessage.message; continue }
    break
  }
  return m || {}
}

/** Devuelve el texto de un mensaje, venga de donde venga. */
export function extraerTexto (message) {
  const m = desenvolver(message)
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  ).trim()
}

/** Describe en una palabra qué clase de mensaje llegó (para avisarte). */
export function tipoDe (message) {
  const m = desenvolver(message)
  if (m.imageMessage) return 'imagen'
  if (m.videoMessage) return 'video'
  if (m.audioMessage) return m.audioMessage.ptt ? 'nota de voz' : 'audio'
  if (m.documentMessage) return 'documento'
  if (m.stickerMessage) return 'sticker'
  if (m.locationMessage) return 'ubicación'
  if (m.contactMessage || m.contactsArrayMessage) return 'contacto'
  return 'texto'
}

/** Id del mensaje citado, si el usuario respondió a otro mensaje. */
export function idCitado (message) {
  const m = desenvolver(message)
  const ctx =
    m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo
  return ctx?.stanzaId || null
}

export const esGrupo = (jid = '') => jid.endsWith('@g.us')
export const esEstado = (jid = '') => jid === 'status@broadcast'
export const esBroadcast = (jid = '') => jid.endsWith('@broadcast')

/** Pausa aleatoria: hace que el bot no conteste como una máquina. */
export const espera = (ms) => new Promise(r => setTimeout(r, ms))

export function demoraNatural (texto = '') {
  // ~1 s por cada 25 caracteres, entre 1,5 y 6 segundos
  const base = 1500 + (texto.length / 25) * 1000
  const jitter = Math.random() * 1200
  return Math.min(6000, base + jitter)
}
