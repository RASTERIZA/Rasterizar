/**
 * Rasterizar S.A.C. — bot de WhatsApp con el dueño al mando.
 *
 * Se conecta como *dispositivo vinculado* del número real (igual que
 * WhatsApp Web), así que el número sigue funcionando normal en el celular.
 *
 *   npm run vincular   primera vez: pide el código de 8 dígitos
 *   npm start          arranca el bot
 *   npm run salir      borra la sesión para vincular otro número
 */
import makeWASocket, {
  DisconnectReason,
  Browsers,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

import { config } from './config.js'
import { store } from './store.js'
import { MENU, numeroDe } from './panel.js'
import { espera, demoraNatural } from './wa.js'
import { crearBot } from './bot.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })

// Modo inicial la primera vez que arranca
if (!store.get().modo) store.set({ modo: config.modo })

let intentos = 0
let cerrando = false
let sock = null

/** Envía un texto; con `natural` imita el ritmo de una persona escribiendo. */
async function enviar (jid, texto, natural = false) {
  if (!sock || !jid || !texto) return null
  if (natural) {
    await sock.presenceSubscribe(jid).catch(() => {})
    await sock.sendPresenceUpdate('composing', jid).catch(() => {})
    await espera(demoraNatural(texto))
    await sock.sendPresenceUpdate('paused', jid).catch(() => {})
  }
  return sock.sendMessage(jid, { text: texto }).catch(e => {
    console.error(`[enviar] ${numeroDe(jid)}: ${e?.message}`)
    return null
  })
}

const bot = crearBot({ enviar })

async function iniciar () {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    browser: Browsers.ubuntu('Rasterizar'),
    // No marcamos "en línea": así el celular sigue recibiendo notificaciones
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false
  })

  sock.ev.on('creds.update', saveCreds)

  // ---- Vinculación por código de 8 dígitos ------------------------------
  if (!sock.authState.creds.registered && config.login === 'codigo') {
    await espera(4000)
    try {
      const codigo = await sock.requestPairingCode(config.numero)
      const bonito = codigo?.match(/.{1,4}/g)?.join('-') || codigo
      console.log(`
╔══════════════════════════════════════════════════════╗
║  CÓDIGO DE VINCULACIÓN:  ${String(bonito).padEnd(28)}║
╚══════════════════════════════════════════════════════╝

En tu celular (número ${config.numero}):
  WhatsApp → Ajustes → Dispositivos vinculados
  → Vincular dispositivo → "Vincular con número de teléfono"
  → escribe el código de arriba.

El código vence en pocos minutos. Si expira, vuelve a ejecutar: npm run vincular
`)
    } catch (e) {
      console.error('[vincular] No se pudo pedir el código:', e?.message)
      console.error('Prueba poniendo WA_LOGIN=qr en el archivo .env')
    }
  }

  // ---- Estado de la conexión --------------------------------------------
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u

    if (qr && config.login === 'qr') {
      console.log('\nEscanea este QR desde WhatsApp → Dispositivos vinculados:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      intentos = 0
      const propio = jidNormalizedUser(sock.user.id)
      const panel = config.duenio ? `${config.duenio}@s.whatsapp.net` : propio
      bot.setPanel(panel)

      const e = store.get()
      console.log(`\n✅ Conectado como ${numeroDe(propio)} — modo ${e.modo}, bot ${e.encendido ? 'encendido' : 'apagado'}`)
      console.log(`   Panel de control: chat de ${numeroDe(panel)}\n`)

      const viejos = store.limpiarPendientes(12)
      await enviar(panel,
        `🟢 *Bot de ${config.empresa.nombre} conectado*\n\n` +
        `Modo actual: *${e.modo}*\n` +
        (viejos ? `(Descarté ${viejos} borrador(es) viejos)\n` : '') +
        `\n${MENU}`
      )
    }

    if (connection === 'close') {
      const codigo = new Boom(lastDisconnect?.error)?.output?.statusCode

      if (codigo === DisconnectReason.loggedOut) {
        console.error('\n❌ La sesión se cerró desde el celular.')
        console.error('   Ejecuta:  npm run salir   y luego:  npm run vincular\n')
        process.exit(1)
      }

      if (cerrando) return

      intentos++
      const ms = Math.min(60_000, 2000 * 2 ** Math.min(intentos, 5))
      console.warn(`⚠️  Conexión cerrada (${codigo ?? 'desconocido'}). Reintento ${intentos} en ${ms / 1000}s`)
      setTimeout(() => iniciar().catch(err => console.error('[reconexión]', err?.message)), ms)
    }
  })

  // ---- Mensajes entrantes ------------------------------------------------
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      try {
        await bot.manejar(msg)
      } catch (e) {
        console.error('[mensaje]', e?.message)
      }
    }
  })

  return sock
}

// ---- Arranque y cierre limpio ---------------------------------------------
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    cerrando = true
    console.log('\n👋 Cerrando el bot. La sesión queda guardada en ./auth')
    process.exit(0)
  })
}

process.on('unhandledRejection', (e) => console.error('[promesa]', e?.message || e))

iniciar().catch(e => {
  console.error('No se pudo iniciar:', e?.message || e)
  process.exit(1)
})
