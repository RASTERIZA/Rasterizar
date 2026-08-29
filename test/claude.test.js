/**
 * Verifica el flujo con Claude sin llamar a la API: se sustituye el módulo
 * `claude.js` por uno falso que apunta con qué se le llamó.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { register } from 'node:module'

process.env.WA_ESTADO = 'data/test-claude.json'
process.env.WA_HISTORIAL = 'data/test-claude-hist.json'
process.env.WA_NUMERO = '51912980371'

// Intercepta el import de claude.js y lo reemplaza por el doble de prueba
register('./doble-claude.js', import.meta.url)

const { crearBot } = await import('../src/bot.js')
const { store } = await import('../src/store.js')
const { historial } = await import('../src/historial.js')
const falso = await import('../src/claude.js')

const PANEL = '51912980371@s.whatsapp.net'
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
  return {
    bot,
    enviados,
    alPanel: () => enviados.filter(e => e.jid === PANEL),
    alCliente: () => enviados.filter(e => e.jid === CLIENTE)
  }
}

const deCliente = (texto) => ({
  key: { remoteJid: CLIENTE, fromMe: false, id: `IN${Math.random()}` },
  pushName: 'Ana Quispe',
  message: { conversation: texto }
})

const delDuenio = (texto, citaId) => ({
  key: { remoteJid: PANEL, fromMe: true, id: `OUT${Math.random()}` },
  message: citaId
    ? { extendedTextMessage: { text: texto, contextInfo: { stanzaId: citaId } } }
    : { conversation: texto }
})

test.beforeEach(() => {
  store.set({ modo: 'aprobacion', encendido: true, pausados: {}, pendientes: {} })
  historial.olvidar(CLIENTE)
  falso.__reset()
})

test.after(() => {
  store.detener()
  historial.detener()
  fs.rmSync('data/test-claude.json', { force: true })
  fs.rmSync('data/test-claude-hist.json', { force: true })
})

test('Claude redacta y el borrador espera tu aprobación', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  falso.__responder('Hola Ana, la lona 3x2 sale S/ 150 instalada.')

  const r = await bot.manejar(deCliente('cuánto una lona de 3x2 instalada'))

  assert.equal(r, 'aprobacion')
  assert.equal(alCliente().length, 0, 'nada sale sin aprobación')
  assert.match(alPanel()[0].texto, /Redactado por Claude/)
  assert.match(alPanel()[0].texto, /S\/ 150/)
})

test('Claude recibe la conversación completa, no solo el último mensaje', async () => {
  const { bot, alPanel } = nuevoBot()
  falso.__responder('¿Va con estructura?')
  await bot.manejar(deCliente('quiero una lona'))
  await bot.manejar(delDuenio('ok', alPanel()[0].id))   // lo apruebas y sale
  falso.__responder('Perfecto, 3x2 son 6 m².')
  await bot.manejar(deCliente('de 3 por 2'))

  const hist = falso.__ultimaLlamada().historial
  assert.deepEqual(hist.map(m => m.de), ['cliente', 'nosotros', 'cliente'])
  assert.equal(hist[0].texto, 'quiero una lona')
  assert.equal(hist[2].texto, 'de 3 por 2')
})

test('cuando falta un precio, el aviso te lo dice y pide tu dato', async () => {
  const { bot, alPanel } = nuevoBot()
  falso.__responder('NECESITO_A_JORGE: falta el precio del m² de mesh', { necesitaJorge: true })

  await bot.manejar(deCliente('cuánto el mesh'))

  assert.match(alPanel()[0].texto, /necesita un precio que no está en tu lista/)
  assert.match(alPanel()[0].texto, /\.cotiza 51987654321/)
  assert.doesNotMatch(alPanel()[0].texto, /NECESITO_A_JORGE/, 'la marca interna no se muestra')
  assert.match(alPanel()[0].texto, /falta el precio del m² de mesh/, 'pero sí lo que falta')
})

test('.cotiza toma la conversación y redacta a tu pedido', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  falso.__responder('Borrador inicial')
  await bot.manejar(deCliente('quiero cotizar un letrero'))

  falso.__responder('Ana, el letrero sale S/ 400 con instalación incluida.')
  const r = await bot.manejar(delDuenio('.cotiza 51987654321 | el letrero va S/ 400 con instalación'))

  assert.equal(r, 'cotiza')
  assert.equal(falso.__ultimaLlamada().instruccion, 'el letrero va S/ 400 con instalación')
  assert.match(alPanel().at(-1).texto, /Cotización lista/)
  assert.match(alPanel().at(-1).texto, /S\/ 400/)
  assert.equal(alCliente().length, 0, 'sigue esperando tu ok')
})

test('apruebas la cotización y recién ahí le llega al cliente', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  falso.__responder('Ana, son S/ 400 con instalación.')
  await bot.manejar(deCliente('cotiza un letrero'))

  await bot.manejar(delDuenio('ok', alPanel()[0].id))

  assert.equal(alCliente().length, 1)
  assert.match(alCliente()[0].texto, /S\/ 400/)
})

test('lo aprobado queda en el historial, para que Claude no se repita', async () => {
  const { bot, alPanel } = nuevoBot()
  falso.__responder('¿Qué medidas necesitas?')
  await bot.manejar(deCliente('quiero un banner'))
  await bot.manejar(delDuenio('ok', alPanel()[0].id))

  const hist = historial.leer(CLIENTE)
  assert.deepEqual(hist.map(m => m.de), ['cliente', 'nosotros'])
  assert.equal(hist[1].texto, '¿Qué medidas necesitas?')
})

test('tu corrección es la que se guarda, no el borrador de Claude', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  falso.__responder('Borrador de Claude')
  await bot.manejar(deCliente('cuánto un banner'))

  await bot.manejar(delDuenio('Ana, son S/ 180 puesto.', alPanel()[0].id))

  assert.equal(alCliente()[0].texto, 'Ana, son S/ 180 puesto.')
  assert.equal(historial.leer(CLIENTE).at(-1).texto, 'Ana, son S/ 180 puesto.')
})

test('si Claude se cae, contesta la plantilla y te avisa', async () => {
  const { bot, alPanel } = nuevoBot()
  falso.__fallar('sin crédito en la cuenta')

  const r = await bot.manejar(deCliente('quiero una gigantografía'))

  assert.equal(r, 'aprobacion')
  assert.match(alPanel()[0].texto, /Claude falló: sin crédito/)
  assert.match(alPanel()[0].texto, /gigantografías/, 'cae a la plantilla, no se queda mudo')
})

test('.cotiza de un número sin historial no inventa nada', async () => {
  const { bot, alPanel } = nuevoBot()
  await bot.manejar(delDuenio('.cotiza 51999888777'))

  assert.match(alPanel().at(-1).texto, /No tengo nada de 51999888777/)
  assert.equal(falso.__ultimaLlamada(), null, 'ni siquiera se llama a Claude')
})

test('sin API key, .cotiza te lo dice en vez de fallar callado', async () => {
  const { bot, alPanel } = nuevoBot()
  falso.__apagarClaude()
  historial.apuntar(CLIENTE, 'cliente', 'hola')

  await bot.manejar(delDuenio('.cotiza 51987654321'))

  assert.match(alPanel().at(-1).texto, /ANTHROPIC_API_KEY/)
})
