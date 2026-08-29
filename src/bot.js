/**
 * Cerebro del bot: decide qué hacer con cada mensaje.
 *
 * No sabe nada de sockets ni de WhatsApp: recibe mensajes y llama a
 * `enviar`. Así se puede probar entero sin conectarse a nada.
 */
import { config } from './config.js'
import { store } from './store.js'
import { redactar, fueraDeHorario, avisoFueraDeHorario } from './comercial.js'
import { esComando, ejecutarComando, resolverCitado, numeroDe } from './panel.js'
import { extraerTexto, tipoDe, idCitado, esGrupo, esEstado, esBroadcast } from './wa.js'
import { historial } from './historial.js'
import { claudeActivo, redactarConClaude, preciosSinLlenar } from './claude.js'

/**
 * @param {object} deps
 * @param {(jid: string, texto: string, natural?: boolean) => Promise<any>} deps.enviar
 *        Manda un texto. `natural` = con "escribiendo…" y demora humana.
 * @param {(...args: any[]) => void} [deps.log]
 */
export function crearBot ({ enviar, log = console.log }) {
  /** id del aviso enviado al dueño -> id del borrador */
  const avisos = new Map()
  /** ids de los mensajes que enviamos nosotros: WhatsApp nos los devuelve
   *  como `fromMe` y no hay que confundirlos con una respuesta manual tuya. */
  const propios = new Set()
  let jidPanel = null

  /** Envía y recuerda el id, para reconocer el eco después. */
  async function mandar (jid, texto, natural = false) {
    const r = await enviar(jid, texto, natural)
    if (jid !== jidPanel) historial.apuntar(jid, 'nosotros', texto)
    const id = r?.key?.id
    if (id) {
      propios.add(id)
      if (propios.size > 500) propios.delete(propios.values().next().value)
    }
    return r
  }

  const recordarAviso = (idMensaje, idBorrador) => {
    if (!idMensaje) return
    avisos.set(idMensaje, idBorrador)
    if (avisos.size > 200) avisos.delete(avisos.keys().next().value)
  }

  /**
   * Redacta el borrador. Con Claude si hay clave configurada; si Claude
   * falla por lo que sea, cae a las plantillas para no dejar a Jorge colgado.
   *
   * @param {string} jid          chat del cliente
   * @param {string} consulta     último mensaje del cliente
   * @param {string} nombre       nombre en WhatsApp
   * @param {string} instruccion  orden puntual de Jorge, si la hay
   */
  async function redactarBorrador (jid, consulta, nombre, instruccion = '') {
    if (claudeActivo()) {
      try {
        const r = await redactarConClaude({
          historial: historial.leer(jid),
          nombre,
          instruccion
        })
        return {
          texto: r.texto,
          linea: 'claude',
          motivo: r.necesitaJorge
            ? '⚠️ Claude necesita un precio que no está en tu lista'
            : (instruccion ? 'Redactado con tu instrucción' : 'Redactado por Claude'),
          necesitaJorge: r.necesitaJorge
        }
      } catch (e) {
        log(`[claude] falló, uso plantilla: ${e?.message}`)
        const base = redactar(consulta, { nombre })
        return { ...base, motivo: `${base.motivo} (Claude falló: ${e?.message})` }
      }
    }
    return redactar(consulta, { nombre })
  }

  /**
   * `.cotiza 51987654321 | agrégale instalación`
   *
   * Jorge da la orden y Claude toma esa conversación: relee todo el hilo
   * con el cliente y redacta. El borrador vuelve al panel para su visto bueno.
   */
  async function cotizarAPedido (numero, instruccion) {
    const jid = `${String(numero).replace(/\D/g, '')}@s.whatsapp.net`

    if (!claudeActivo()) {
      await mandar(jidPanel,
        '⚠️ Claude no está conectado. Falta poner ANTHROPIC_API_KEY en el archivo .env.\n' +
        'Mientras tanto puedes escribirle tú: *.enviar ' + numeroDe(jid) + ' | tu mensaje*')
      return
    }

    if (!historial.tieneCliente(jid)) {
      await mandar(jidPanel,
        `No tengo nada de ${numeroDe(jid)} en el historial, así que no sé qué cotizar.\n` +
        'Si ya te escribió, revisa que el número esté bien. Si quieres escribirle tú: ' +
        `*.enviar ${numeroDe(jid)} | tu mensaje*`)
      return
    }

    const ultimo = [...historial.leer(jid)].reverse().find(m => m.de === 'cliente')?.texto || ''
    const borrador = await redactarBorrador(jid, ultimo, '', instruccion)

    const id = store.nuevoPendiente({ jid, nombre: '', texto: borrador.texto, consulta: ultimo })
    const aviso = await mandar(jidPanel,
      `📝 *Cotización lista* — borrador #${id}\n` +
      `👤 wa.me/${numeroDe(jid)}\n` +
      (instruccion ? `🗣️ Tu instrucción: "${instruccion}"\n` : '') +
      `🏷️ ${borrador.motivo}\n` +
      '─────────────────────\n' +
      `${borrador.texto}\n` +
      '─────────────────────\n' +
      'Responde a este mensaje con *ok*, *no*, o el texto corregido.\n' +
      `También: .ok ${id}  /  .no ${id}`
    )
    recordarAviso(aviso?.key?.id, id)
  }

  /** Aviso al dueño, sin borrador que aprobar. */
  async function avisar ({ jid, nombre, consulta, nota }) {
    if (!jidPanel) return
    await mandar(jidPanel,
      '🔔 *Mensaje nuevo*\n' +
      `👤 ${nombre || 'Sin nombre'} · wa.me/${numeroDe(jid)}\n` +
      `💬 "${consulta.slice(0, 300)}"\n` +
      `ℹ️ ${nota}`
    )
  }

  /** Aplica el resultado de un comando o de una aprobación. */
  async function aplicar (r) {
    if (!r) return
    if (r.enviar) await mandar(r.enviar.jid, r.enviar.texto, true)
    if (r.respuesta) await mandar(jidPanel, r.respuesta)
  }

  async function manejar (msg) {
    const jid = msg?.key?.remoteJid
    if (!jid || esEstado(jid) || esBroadcast(jid)) return 'ignorado'
    if (!msg.message) return 'ignorado'

    const texto = extraerTexto(msg.message)

    // Si WA_DUENIO está vacío el panel es tu propio chat y tus órdenes
    // llegan como `fromMe`; si configuraste otro número, llegan como
    // mensajes entrantes de ese número.
    const esPanel = Boolean(jidPanel) && jid === jidPanel
    const ordenDelDuenio = esPanel && (config.duenio ? !msg.key.fromMe : msg.key.fromMe)

    // ── 1. Órdenes tuyas desde el celular ────────────────────────────
    if (ordenDelDuenio) {
      if (!texto) return 'ignorado'

      // Respondiste citando un aviso: ok / no / texto corregido
      const citado = idCitado(msg.message)
      if (citado && avisos.has(citado)) {
        const r = resolverCitado(avisos.get(citado), texto)
        if (r) {
          avisos.delete(citado)
          await aplicar(r)
          return 'aprobacion'
        }
      }

      // .cotiza es tuyo: le das la orden y Claude toma esa conversación
      const orden = texto.trim().match(/^[./!](cotiza|claude|redacta)\s+([^|]+)(?:\|\s*(.*))?$/is)
      if (orden) {
        await cotizarAPedido(orden[2].trim(), (orden[3] || '').trim())
        return 'cotiza'
      }

      if (esComando(texto)) {
        await aplicar(await ejecutarComando(texto))
        return 'comando'
      }
      return 'ignorado'
    }

    // Lo que el propio bot escribió en el panel no es una orden ni una
    // intervención manual: es solo el eco de nuestro mensaje.
    if (esPanel) return 'ignorado'
    if (propios.has(msg.key.id)) return 'eco'

    // ── 2. Tú contestando a mano en el chat de un cliente ────────────
    //      el bot se calla ahí para no pisarte
    if (msg.key.fromMe) {
      if (!esGrupo(jid) && !store.estaPausado(jid)) {
        store.pausar(jid, config.pausaMin)
        log(`🔇 ${numeroDe(jid)} en pausa ${config.pausaMin} min (respondiste tú)`)
      }
      return 'takeover'
    }

    // ── 3. Mensaje de un cliente ─────────────────────────────────────
    if (esGrupo(jid) && !config.grupos) return 'ignorado'

    const e = store.get()
    if (!e.encendido) return 'apagado'
    if (store.estaPausado(jid)) return 'pausado'

    const nombre = msg.pushName || ''
    const clase = tipoDe(msg.message)
    const consulta = texto || `(${clase})`

    log(`📩 ${numeroDe(jid)} (${nombre}): ${consulta.slice(0, 80)}`)
    historial.apuntar(jid, 'cliente', consulta)

    // Fotos, audios y documentos los ves tú: el bot no adivina qué traen
    const necesitaOjoHumano = !texto && clase !== 'texto'

    if (e.modo === 'manual' || necesitaOjoHumano) {
      await avisar({
        jid,
        nombre,
        consulta,
        nota: necesitaOjoHumano
          ? `Llegó *${clase}* sin texto — revísalo tú.`
          : 'Modo manual: no respondí nada.'
      })
      if (necesitaOjoHumano) store.pausar(jid, config.pausaMin)
      return necesitaOjoHumano ? 'humano' : 'manual'
    }

    const borrador = await redactarBorrador(jid, consulta, nombre)

    if (e.modo === 'auto') {
      await mandar(jid, borrador.texto, true)
      if (fueraDeHorario()) await mandar(jid, avisoFueraDeHorario(), true)
      await avisar({ jid, nombre, consulta, nota: `Respondí automáticamente (${borrador.linea}).` })
      return 'auto'
    }

    // modo aprobación: nada sale sin tu visto bueno
    const id = store.nuevoPendiente({ jid, nombre, texto: borrador.texto, consulta })
    const aviso = await mandar(jidPanel,
      `🔔 *Mensaje nuevo* — borrador #${id}\n` +
      `👤 ${nombre || 'Sin nombre'} · wa.me/${numeroDe(jid)}\n` +
      `💬 "${consulta.slice(0, 300)}"\n` +
      `🏷️ ${borrador.motivo}\n` +
      '─────────────────────\n' +
      `${borrador.texto}\n` +
      '─────────────────────\n' +
      (borrador.necesitaJorge
        ? 'Pásame el precio y lo rehago: *.cotiza ' + numeroDe(jid) + ' | el m² de lona va S/ 25*\n'
        : 'Responde a este mensaje con *ok*, *no*, o el texto corregido.\n') +
      `También: .ok ${id}  /  .no ${id}`
    )
    recordarAviso(aviso?.key?.id, id)
    return 'aprobacion'
  }

  return {
    manejar,
    avisos,
    propios,
    setPanel: (jid) => { jidPanel = jid },
    get panel () { return jidPanel }
  }
}
