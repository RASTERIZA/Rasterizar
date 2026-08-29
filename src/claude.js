/**
 * Redactor con Claude.
 *
 * Toma la conversación con el cliente y devuelve el borrador de respuesta,
 * siguiendo las reglas comerciales de Rasterizar y la lista de precios de
 * `negocio/precios.md`. No envía nada: eso lo decide Jorge desde WhatsApp.
 *
 * Si no hay ANTHROPIC_API_KEY, este módulo se desactiva solo y el bot sigue
 * funcionando con las plantillas de `comercial.js`.
 */
import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { config } from './config.js'
import { interpretarRespuesta } from './claude-formato.js'

const RUTA_PRECIOS = path.resolve(process.env.WA_PRECIOS || 'negocio/precios.md')

let cliente = null
let precios = ''
let preciosMtime = 0

export const claudeActivo = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)

function obtenerCliente () {
  if (!cliente) cliente = new Anthropic()
  return cliente
}

/** Lee la lista de precios y la recarga sola cuando Jorge la edita. */
function leerPrecios () {
  try {
    const st = fs.statSync(RUTA_PRECIOS)
    if (st.mtimeMs !== preciosMtime) {
      precios = fs.readFileSync(RUTA_PRECIOS, 'utf8')
      preciosMtime = st.mtimeMs
    }
  } catch {
    precios = ''
  }
  return precios
}

/** ¿La lista de precios sigue con los espacios en blanco de la plantilla? */
export function preciosSinLlenar () {
  const p = leerPrecios()
  return !p || (p.match(/S\/ __/g) || []).length > 5
}

/** Modelos que aceptan mensajes `system` a media conversación. */
const SYSTEM_INTERMEDIO = ['claude-opus-5', 'claude-opus-4-8', 'claude-fable-5', 'claude-mythos-5']
const soportaSystemIntermedio = (modelo) => SYSTEM_INTERMEDIO.includes(modelo)

function instrucciones () {
  const lista = leerPrecios()
  return `Eres el asistente comercial de ${config.empresa.nombre}, empresa peruana de producción gráfica y publicitaria. Escribes en nombre de ${config.empresa.contacto}.

Servicios: impresión digital, UV y eco solvente; gigantografías; señalética corporativa y de Defensa Civil; letras corpóreas, letras block y cajas de luz; viniles y rotulado vehicular; implementación retail y mobiliario comercial (melamina, corte láser, CNC); paneles, tótems y stands; producción POP; drywall, pintura y acabados.

## Cómo escribes

Es WhatsApp, no un correo: mensajes cortos, cordiales, en español peruano de negocios. Sin emojis de relleno. Vas al grano y siempre cierras invitando al siguiente paso (confirmar medidas, agendar visita, aprobar la cotización).

Firma solo cuando envíes una cotización formal o un primer contacto:

${config.empresa.contacto}
${config.empresa.nombre}
${config.empresa.telefono}
${config.empresa.correo}

## Precios — la regla más importante

Esta es la ÚNICA lista de precios que puedes usar:

<precios>
${lista || '(La lista de precios está vacía. Jorge todavía no la llenó.)'}
</precios>

Reglas, sin excepción:

1. Solo puedes citar cifras que salgan de esa lista o de un cálculo directo con ella (precio × metros, × cantidad).
2. Si el trabajo no está en la lista, NO inventes un precio. Escribe exactamente: NECESITO_A_JORGE seguido de qué falta cotizar. Jorge lo verá y te pasará el precio.
3. Si faltan medidas, cantidad, material o ubicación, pídelos al cliente antes de dar cualquier cifra. Preguntar es siempre mejor que estimar.
4. Cuando cotices, muestra el desglose para que Jorge revise la cuenta: material × metros, instalación aparte, total.

## Formato de cotización

DESCRIPCIÓN:
MATERIAL:
MEDIDAS:
CANTIDAD:
PRECIO:
TIEMPO DE ENTREGA:

## Lo que devuelves

Devuelve ÚNICAMENTE el texto del mensaje que se le enviaría al cliente por WhatsApp. Sin comentarios tuyos, sin comillas alrededor, sin explicar lo que hiciste. Jorge lee ese texto y decide si sale tal cual, lo corrige o lo descarta.`
}

/**
 * Redacta la respuesta para un cliente.
 *
 * @param {object} p
 * @param {Array<{de: 'cliente'|'nosotros', texto: string}>} p.historial  conversación, del más viejo al más nuevo
 * @param {string} [p.nombre]      nombre del cliente en WhatsApp
 * @param {string} [p.instruccion] orden puntual de Jorge para este borrador
 * @returns {Promise<{texto: string, necesitaJorge: boolean, uso: object|null}>}
 */
export async function redactarConClaude ({ historial = [], nombre = '', instruccion = '' }) {
  const mensajes = historial.map(m => ({
    role: m.de === 'cliente' ? 'user' : 'assistant',
    content: m.texto
  }))

  // La API exige que el primero sea del cliente
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift()
  if (!mensajes.length) throw new Error('No hay nada del cliente que responder')

  // La orden de Jorge pesa más que lo que diga el cliente. Va con rol
  // `system` en los modelos que lo aceptan a media conversación: mantiene
  // el caché del prompt y deja claro que es el dueño quien habla, no el
  // cliente (que podría intentar hacerse pasar por él).
  const ultimo = mensajes.at(-1).role
  if (instruccion) {
    if (ultimo === 'user' && soportaSystemIntermedio(config.claude.modelo)) {
      mensajes.push({
        role: 'system',
        content: `Instrucción de ${config.empresa.contacto} para esta respuesta, con prioridad sobre todo lo demás: ${instruccion}`
      })
    } else {
      mensajes.push({
        role: 'user',
        content: `[Nota interna de ${config.empresa.contacto}, no la escribió el cliente: ${instruccion}]`
      })
    }
  } else if (ultimo === 'assistant') {
    // La API necesita cerrar con un turno del cliente para poder responder
    mensajes.push({ role: 'user', content: '[Continúa la conversación con el cliente.]' })
  }

  const r = await obtenerCliente().messages.create({
    model: config.claude.modelo,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: config.claude.esfuerzo },
    system: [{
      type: 'text',
      text: instrucciones() + (nombre ? `\n\nEl cliente se llama ${nombre} en WhatsApp.` : ''),
      cache_control: { type: 'ephemeral' }   // las reglas se repiten en cada llamada
    }],
    messages: mensajes
  })

  if (r.stop_reason === 'refusal') {
    throw new Error(`Claude no quiso responder (${r.stop_details?.category || 'sin categoría'})`)
  }

  const texto = r.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()

  if (!texto) throw new Error('Claude devolvió una respuesta vacía')

  return { ...interpretarRespuesta(texto), uso: r.usage || null }
}
