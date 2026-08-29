/**
 * Interpreta lo que devuelve Claude.
 *
 * Va aparte de `claude.js` para poder probarlo sin llamar a la API — y para
 * que el doble de prueba use exactamente la misma lógica que producción.
 */

/** Marca con la que Claude avisa que le falta un precio de la lista. */
const MARCA = /NECESITO_A_JORGE\s*:?\s*/gi

/**
 * @param {string} bruto  texto tal cual lo devolvió Claude
 * @returns {{texto: string, necesitaJorge: boolean}}
 */
export function interpretarRespuesta (bruto = '') {
  const necesitaJorge = /NECESITO_A_JORGE/i.test(bruto)
  return {
    texto: bruto.replace(MARCA, '').trim(),
    necesitaJorge
  }
}
