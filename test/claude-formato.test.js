/** El parseo real de lo que devuelve Claude, sin dobles de por medio. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { interpretarRespuesta } from '../src/claude-formato.js'

test('una respuesta normal pasa intacta', () => {
  const r = interpretarRespuesta('Hola Ana, la lona 3x2 sale S/ 150.')
  assert.equal(r.texto, 'Hola Ana, la lona 3x2 sale S/ 150.')
  assert.equal(r.necesitaJorge, false)
})

test('la marca interna se detecta y se borra del texto', () => {
  for (const bruto of [
    'NECESITO_A_JORGE: falta el precio del mesh',
    'NECESITO_A_JORGE falta el precio del mesh',
    'necesito_a_jorge: falta el precio del mesh'
  ]) {
    const r = interpretarRespuesta(bruto)
    assert.equal(r.necesitaJorge, true, bruto)
    assert.equal(r.texto, 'falta el precio del mesh', bruto)
  }
})

test('la marca se borra aunque venga en medio del texto', () => {
  const r = interpretarRespuesta('Hola Ana.\nNECESITO_A_JORGE: el precio del mesh')
  assert.equal(r.necesitaJorge, true)
  assert.doesNotMatch(r.texto, /NECESITO_A_JORGE/)
  assert.match(r.texto, /Hola Ana/)
  assert.match(r.texto, /el precio del mesh/)
})

test('el texto vacío no revienta', () => {
  assert.deepEqual(interpretarRespuesta(), { texto: '', necesitaJorge: false })
  assert.deepEqual(interpretarRespuesta('   '), { texto: '', necesitaJorge: false })
})
