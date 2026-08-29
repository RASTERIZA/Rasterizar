/**
 * Variante: el panel de control está en OTRO número (WA_DUENIO).
 * Ahí tus órdenes llegan como mensajes entrantes, no como `fromMe`.
 * Va en su propio archivo porque la configuración se lee una sola vez.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.WA_ESTADO = 'data/test-duenio.json'
process.env.WA_NUMERO = '51912980371'
process.env.WA_DUENIO = '51914858708'

const { crearBot } = await import('../src/bot.js')
const { store } = await import('../src/store.js')

const PANEL = '51914858708@s.whatsapp.net'
const CLIENTE = '51987654321@s.whatsapp.net'

function nuevoBot () {
  const enviados = []
  let n = 0
  const bot = crearBot({
    enviar: async (jid, texto) => {
      const key = { id: `M${++n}` }
      enviados.push({ jid, texto, id: key.id })
      return { key }
    },
    log: () => {}
  })
  bot.setPanel(PANEL)
  return { bot, enviados, alPanel: () => enviados.filter(e => e.jid === PANEL), alCliente: () => enviados.filter(e => e.jid === CLIENTE) }
}

test.beforeEach(() => store.set({ modo: 'aprobacion', encendido: true, pausados: {}, pendientes: {} }))
test.after(() => { store.detener(); fs.rmSync('data/test-duenio.json', { force: true }) })

test('los comandos del segundo número sí se obedecen', async () => {
  const { bot, alPanel } = nuevoBot()
  const r = await bot.manejar({
    key: { remoteJid: PANEL, fromMe: false, id: 'C1' },
    message: { conversation: '.modo auto' }
  })
  assert.equal(r, 'comando')
  assert.equal(store.get().modo, 'auto')
  assert.match(alPanel().at(-1).texto, /Modo \*auto\*/)
  store.set({ modo: 'aprobacion' })
})

test('el dueño aprueba desde el segundo número citando el aviso', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  await bot.manejar({
    key: { remoteJid: CLIENTE, fromMe: false, id: 'IN' },
    pushName: 'Ana',
    message: { conversation: 'quiero una gigantografía' }
  })
  const idAviso = alPanel()[0].id

  await bot.manejar({
    key: { remoteJid: PANEL, fromMe: false, id: 'C2' },
    message: { extendedTextMessage: { text: 'ok', contextInfo: { stanzaId: idAviso } } }
  })

  assert.equal(alCliente().length, 1)
  assert.match(alCliente()[0].texto, /gigantografías/)
})

test('el panel nunca se trata como un cliente', async () => {
  const { bot, enviados } = nuevoBot()
  const r = await bot.manejar({
    key: { remoteJid: PANEL, fromMe: false, id: 'C3' },
    message: { conversation: 'quiero una gigantografía de 3x2' }
  })
  assert.equal(r, 'ignorado')
  assert.equal(enviados.length, 0, 'al dueño no se le cotiza')
})
