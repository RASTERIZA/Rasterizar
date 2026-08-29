/**
 * Prueba el recorrido completo de un mensaje sin conectarse a WhatsApp:
 * se sustituye el envío real por una función que apunta lo enviado.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.WA_ESTADO = 'data/test-flujo.json'
process.env.WA_HISTORIAL = 'data/test-flujo-hist.json'
process.env.WA_NUMERO ||= '51912980371'

const { crearBot } = await import('../src/bot.js')
const { store } = await import('../src/store.js')
const { historial } = await import('../src/historial.js')
const { config } = await import('../src/config.js')

const PANEL = '51912980371@s.whatsapp.net'
const CLIENTE = '51987654321@s.whatsapp.net'

function nuevoBot () {
  const enviados = []
  let n = 0
  const bot = crearBot({
    enviar: async (jid, texto) => {
      const key = { id: `MSG${++n}` }
      enviados.push({ jid, texto, id: key.id })
      return { key }
    },
    log: () => {}
  })
  bot.setPanel(PANEL)
  return { bot, enviados, alPanel: () => enviados.filter(e => e.jid === PANEL), alCliente: () => enviados.filter(e => e.jid === CLIENTE) }
}

const deCliente = (texto, extra = {}) => ({
  key: { remoteJid: CLIENTE, fromMe: false, id: 'IN1' },
  pushName: 'Ana Quispe',
  message: { conversation: texto },
  ...extra
})

const delDuenio = (texto, citaId) => ({
  key: { remoteJid: PANEL, fromMe: true, id: 'OUT1' },
  message: citaId
    ? { extendedTextMessage: { text: texto, contextInfo: { stanzaId: citaId } } }
    : { conversation: texto }
})

function reset (modo = 'aprobacion') {
  store.set({ modo, encendido: true, pausados: {}, pendientes: {}, saludados: {} })
}

test.beforeEach(() => reset())
test.after(() => { store.detener(); historial.detener(); fs.rmSync('data/test-flujo.json', { force: true }); fs.rmSync('data/test-flujo-hist.json', { force: true }) })

test('modo aprobación: al cliente no le llega nada hasta que tú digas', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  const r = await bot.manejar(deCliente('cuánto cuesta una gigantografía de 3x2'))

  assert.equal(r, 'aprobacion')
  assert.equal(alCliente().length, 0, 'el cliente NO debe recibir nada todavía')
  assert.equal(alPanel().length, 1)
  assert.match(alPanel()[0].texto, /borrador #/)
  assert.match(alPanel()[0].texto, /wa\.me\/51987654321/)
})

test('respondes "ok" citando el aviso y recién ahí sale', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  await bot.manejar(deCliente('necesito letras corpóreas'))
  const idAviso = alPanel()[0].id

  await bot.manejar(delDuenio('ok', idAviso))

  assert.equal(alCliente().length, 1)
  assert.match(alCliente()[0].texto, /letras corpóreas/)
  assert.match(alPanel().at(-1).texto, /Enviado a 51987654321/)
})

test('respondes "no" y no sale nada; el chat queda para ti', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  await bot.manejar(deCliente('quiero señalética'))
  await bot.manejar(delDuenio('no', alPanel()[0].id))

  assert.equal(alCliente().length, 0)
  assert.equal(store.estaPausado(CLIENTE), true)
})

test('escribes tu propio texto y se envía el tuyo, no el del bot', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  await bot.manejar(deCliente('quiero un banner'))
  await bot.manejar(delDuenio('Ana, pásate el lunes por el taller y lo vemos.', alPanel()[0].id))

  assert.equal(alCliente().length, 1)
  assert.equal(alCliente()[0].texto, 'Ana, pásate el lunes por el taller y lo vemos.')
})

test('modo auto: responde solo y te avisa', async () => {
  reset('auto')
  const { bot, alPanel, alCliente } = nuevoBot()
  const r = await bot.manejar(deCliente('quiero un módulo de melamina'))

  assert.equal(r, 'auto')
  assert.ok(alCliente().length >= 1)
  assert.match(alPanel().at(-1).texto, /Respondí automáticamente/)
})

test('modo manual: no responde nada, solo te avisa', async () => {
  reset('manual')
  const { bot, alPanel, alCliente } = nuevoBot()
  const r = await bot.manejar(deCliente('hola, quiero cotizar'))

  assert.equal(r, 'manual')
  assert.equal(alCliente().length, 0)
  assert.match(alPanel()[0].texto, /Modo manual/)
})

test('con el bot apagado no sale ni un mensaje', async () => {
  store.set({ encendido: false })
  const { bot, enviados } = nuevoBot()
  assert.equal(await bot.manejar(deCliente('hola')), 'apagado')
  assert.equal(enviados.length, 0)
})

test('si contestas tú a mano, el bot se calla en ese chat', async () => {
  const { bot } = nuevoBot()
  const r = await bot.manejar({
    key: { remoteJid: CLIENTE, fromMe: true, id: 'MANUAL' },
    message: { conversation: 'Hola Ana, te llamo en 10 min' }
  })

  assert.equal(r, 'takeover')
  assert.equal(store.estaPausado(CLIENTE), true)
  assert.equal(await bot.manejar(deCliente('gracias')), 'pausado')
})

test('una foto sin texto te la pasa a ti, no la contesta el bot', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  const r = await bot.manejar({
    key: { remoteJid: CLIENTE, fromMe: false, id: 'IMG' },
    pushName: 'Ana',
    message: { imageMessage: {} }
  })

  assert.equal(r, 'humano')
  assert.equal(alCliente().length, 0)
  assert.match(alPanel()[0].texto, /imagen.*revísalo tú/s)
  assert.equal(store.estaPausado(CLIENTE), true)
})

test('los estados de WhatsApp y los grupos se ignoran', async () => {
  const { bot, enviados } = nuevoBot()
  assert.equal(await bot.manejar({ key: { remoteJid: 'status@broadcast', fromMe: false }, message: { conversation: 'x' } }), 'ignorado')
  assert.equal(await bot.manejar({ key: { remoteJid: '120@g.us', fromMe: false }, message: { conversation: 'hola' } }), 'ignorado')
  assert.equal(enviados.length, 0)
})

test('los comandos del panel funcionan desde tu chat', async () => {
  const { bot, alPanel } = nuevoBot()
  assert.equal(await bot.manejar(delDuenio('.modo auto')), 'comando')
  assert.equal(store.get().modo, 'auto')
  assert.match(alPanel().at(-1).texto, /Modo \*auto\*/)
})

test('un texto normal tuyo en el panel no dispara nada', async () => {
  const { bot, enviados } = nuevoBot()
  assert.equal(await bot.manejar(delDuenio('nota para mí: comprar vinil')), 'ignorado')
  assert.equal(enviados.length, 0)
})

test('.enviar manda el mensaje al cliente indicado', async () => {
  const { bot, alCliente } = nuevoBot()
  await bot.manejar(delDuenio('.enviar 51987654321 | Buenos días, le escribo de Rasterizar'))
  assert.equal(alCliente().length, 1)
  assert.match(alCliente()[0].texto, /Buenos días/)
})

test('la memoria de avisos no crece sin límite', async () => {
  const { bot } = nuevoBot()
  for (let i = 0; i < 260; i++) await bot.manejar(deCliente(`consulta ${i} de gigantografía`))
  assert.ok(bot.avisos.size <= 200, `avisos=${bot.avisos.size}`)
})

test('la pausa automática usa los minutos configurados', () => {
  assert.equal(typeof config.pausaMin, 'number')
  assert.ok(config.pausaMin > 0)
})

test('el eco de lo que envía el bot no pausa el chat del cliente', async () => {
  const { bot, alPanel, alCliente } = nuevoBot()
  await bot.manejar(deCliente('quiero un banner'))
  await bot.manejar(delDuenio('ok', alPanel()[0].id))

  const idEnviado = alCliente()[0].id
  // WhatsApp nos devuelve nuestro propio mensaje marcado como fromMe
  const r = await bot.manejar({
    key: { remoteJid: CLIENTE, fromMe: true, id: idEnviado },
    message: { conversation: alCliente()[0].texto }
  })

  assert.equal(r, 'eco')
  assert.equal(store.estaPausado(CLIENTE), false, 'el chat no debe quedar en pausa por nuestro propio envío')
})

test('el eco de nuestros avisos en el panel no dispara nada', async () => {
  const { bot, alPanel, enviados } = nuevoBot()
  await bot.manejar(deCliente('quiero señalética'))
  const antes = enviados.length

  const r = await bot.manejar({
    key: { remoteJid: PANEL, fromMe: true, id: alPanel()[0].id },
    message: { conversation: alPanel()[0].texto }
  })

  assert.equal(r, 'ignorado')
  assert.equal(enviados.length, antes)
})

test('la memoria de ids propios tampoco crece sin límite', async () => {
  reset('auto')
  const { bot } = nuevoBot()
  for (let i = 0; i < 300; i++) {
    store.reanudar(CLIENTE)
    await bot.manejar(deCliente(`banner ${i}`))
  }
  assert.ok(bot.propios.size <= 500, `propios=${bot.propios.size}`)
})

test('.enviar deja ese chat en tus manos', async () => {
  const { bot, alCliente } = nuevoBot()
  await bot.manejar(delDuenio('.enviar 51987654321 | Ana, ya salió tu trabajo'))

  assert.equal(alCliente().length, 1)
  assert.equal(store.estaPausado(CLIENTE), true)
  assert.equal(await bot.manejar(deCliente('gracias, y el precio?')), 'pausado')
})
