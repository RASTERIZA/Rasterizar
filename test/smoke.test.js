import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

process.env.WA_ESTADO = 'data/test-smoke.json'
process.env.WA_HISTORIAL = 'data/test-smoke-hist.json'
process.env.WA_NUMERO ||= '51912980371'
process.env.EMPRESA_NOMBRE ||= 'Rasterizar S.A.C.'

const { redactar, detectarLinea, fueraDeHorario } = await import('../src/comercial.js')
const { extraerTexto, tipoDe, idCitado, esGrupo, demoraNatural } = await import('../src/wa.js')
const { esComando, ejecutarComando, resolverCitado } = await import('../src/panel.js')
const { store } = await import('../src/store.js')
const { historial } = await import('../src/historial.js')

test('detecta la línea de negocio, con y sin tildes', () => {
  assert.equal(detectarLinea('quiero una gigantografía 3x2').id, 'gigantografia')
  assert.equal(detectarLinea('SEÑALÉTICA de defensa civil').id, 'senaletica')
  assert.equal(detectarLinea('letras corporeas iluminadas').id, 'letras')
  assert.equal(detectarLinea('un módulo de melamina').id, 'retail')
  assert.equal(detectarLinea('hola qué tal'), null)
})

test('nunca inventa un precio final', () => {
  for (const q of ['cuanto cuesta un banner', 'precio de letras corporeas', 'presupuesto de melamina']) {
    const r = redactar(q, { nombre: 'Ana' })
    assert.match(r.texto, /indícanos|necesitamos saber/i, `debería pedir datos: ${q}`)
    assert.doesNotMatch(r.texto, /S\/\s?\d|\bsoles\b|\$\s?\d/i, `no debe dar cifras: ${q}`)
  }
})

test('la firma comercial va en toda respuesta al cliente', () => {
  const r = redactar('necesito señalética', { nombre: 'Luis Torres' })
  assert.match(r.texto, /Jorge Luis Pampas Sarmiento/)
  assert.match(r.texto, /proyectos@rasteriza\.com/)
  assert.match(r.texto, /^Hola Luis,/)
})

test('ignora nombres raros al saludar', () => {
  assert.match(redactar('hola', { nombre: '+51 987 654 321' }).texto, /^Hola,/)
})

test('fueraDeHorario responde un booleano', () => {
  assert.equal(typeof fueraDeHorario(), 'boolean')
})

test('extrae texto de mensajes anidados y con media', () => {
  assert.equal(extraerTexto({ conversation: 'hola' }), 'hola')
  assert.equal(extraerTexto({ ephemeralMessage: { message: { conversation: 'efímero' } } }), 'efímero')
  assert.equal(extraerTexto({ imageMessage: { caption: 'mira esto' } }), 'mira esto')
  assert.equal(extraerTexto({ audioMessage: { ptt: true } }), '')
  assert.equal(tipoDe({ audioMessage: { ptt: true } }), 'nota de voz')
  assert.equal(idCitado({ extendedTextMessage: { text: 'x', contextInfo: { stanzaId: 'ID1' } } }), 'ID1')
  assert.equal(esGrupo('120@g.us'), true)
})

test('la demora simulada se mantiene en un rango humano', () => {
  for (const t of ['ok', 'x'.repeat(500)]) {
    const d = demoraNatural(t)
    assert.ok(d >= 1500 && d <= 6000, `fuera de rango: ${d}`)
  }
})

test('reconoce comandos por prefijo', () => {
  assert.equal(esComando('.estado'), true)
  assert.equal(esComando('/menu'), true)
  assert.equal(esComando('hola'), false)
})

test('cambiar de modo queda guardado', async () => {
  await ejecutarComando('.modo manual')
  assert.equal(store.get().modo, 'manual')
  await ejecutarComando('.modo aprobacion')
  assert.equal(store.get().modo, 'aprobacion')
  const r = await ejecutarComando('.modo volar')
  assert.match(r.respuesta, /Modos válidos/)
})

test('.off deja el bot apagado y .on lo revive', async () => {
  await ejecutarComando('.off')
  assert.equal(store.get().encendido, false)
  await ejecutarComando('.on')
  assert.equal(store.get().encendido, true)
})

test('.enviar arma el destino correcto', async () => {
  const r = await ejecutarComando('.enviar 51 987 654 321 | Buenos días')
  assert.equal(r.enviar.jid, '51987654321@s.whatsapp.net')
  assert.equal(r.enviar.texto, 'Buenos días')
})

test('.enviar sin cuerpo explica cómo se usa', async () => {
  const r = await ejecutarComando('.enviar 51987654321')
  assert.match(r.respuesta, /Uso:/)
})

test('aprobar envía el borrador y lo saca de pendientes', () => {
  const id = store.nuevoPendiente({ jid: '51900@s.whatsapp.net', nombre: 'Ana', texto: 'Borrador', consulta: 'hola' })
  const r = resolverCitado(id, 'ok')
  assert.equal(r.enviar.texto, 'Borrador')
  assert.equal(store.verPendiente(id), undefined)
})

test('rechazar no envía nada y pausa el chat', () => {
  const jid = '51901@s.whatsapp.net'
  const id = store.nuevoPendiente({ jid, nombre: 'Ana', texto: 'Borrador', consulta: 'hola' })
  const r = resolverCitado(id, 'no')
  assert.equal(r.enviar, undefined)
  assert.equal(store.estaPausado(jid), true)
})

test('un texto libre reemplaza el borrador', () => {
  const id = store.nuevoPendiente({ jid: '51902@s.whatsapp.net', nombre: 'Ana', texto: 'Borrador', consulta: 'hola' })
  const r = resolverCitado(id, 'Mejor dile que pase el lunes')
  assert.equal(r.enviar.texto, 'Mejor dile que pase el lunes')
})

test('un borrador ya resuelto no se puede reenviar', () => {
  const id = store.nuevoPendiente({ jid: '51903@s.whatsapp.net', texto: 'X', consulta: 'y' })
  resolverCitado(id, 'ok')
  assert.equal(resolverCitado(id, 'ok'), null)
})

test('los borradores viejos se descartan', () => {
  const id = store.nuevoPendiente({ jid: '51904@s.whatsapp.net', texto: 'X', consulta: 'y' })
  store.get().pendientes[id].ts = Date.now() - 24 * 3600_000
  assert.ok(store.limpiarPendientes(12) >= 1)
  assert.equal(store.verPendiente(id), undefined)
})

test.after(() => { store.detener(); historial.detener(); fs.rmSync('data/test-smoke.json', { force: true }); fs.rmSync('data/test-smoke-hist.json', { force: true }) })
