/**
 * Hook de carga: cuando alguien importa `src/claude.js`, le entregamos
 * `test/falso-claude.js`. Así probamos todo el flujo sin llamar a la API.
 */
const FALSO = new URL('falso-claude.js', import.meta.url).href

export async function resolve (especificador, contexto, siguiente) {
  if (/(^|\/)claude\.js$/.test(especificador) && !especificador.includes('falso-')) {
    return { url: FALSO, shortCircuit: true }
  }
  return siguiente(especificador, contexto)
}
