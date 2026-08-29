/**
 * Redactor comercial de Rasterizar S.A.C.
 *
 * Reglas del negocio (definidas por Jorge Luis Pampas Sarmiento):
 *  - Nunca dar un precio final si faltan medidas o cantidad.
 *  - Pedir siempre: medidas, cantidad, ubicación, material y si hay diseño.
 *  - Tono comercial peruano, breve, cordial, orientado al cierre.
 *
 * Este módulo NO envía nada: solo devuelve un borrador. Quien decide
 * si sale o no es el dueño (ver src/index.js, modo "aprobacion").
 */
import { config } from './config.js'

const norm = (t = '') =>
  t.toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

/** Catálogo: cada línea con las palabras que la disparan y qué datos faltan. */
const LINEAS = [
  {
    id: 'gigantografia',
    nombre: 'gigantografías e impresión de gran formato',
    claves: ['gigantografia', 'banner', 'banderola', 'lona', 'impresion gran formato', 'eco solvente', 'ecosolvente', 'panel publicitario', 'valla'],
    pide: ['las medidas (ancho x alto)', 'la cantidad', 'si va con estructura o solo la impresión'],
    nota: 'Trabajamos lona front, mesh y vinil, con impresión eco solvente de alta resolución.'
  },
  {
    id: 'letras',
    nombre: 'letras corpóreas, letras block y cajas de luz',
    claves: ['letra corporea', 'letras corporeas', 'corporeo', 'letra block', 'caja de luz', 'letrero luminoso', 'luminoso', 'led'],
    pide: ['la altura de cada letra y el texto completo', 'si van iluminadas (LED) o sin iluminación', 'el lugar de instalación'],
    nota: 'Fabricamos en acrílico, MDF, Celtex y acero, con o sin iluminación LED.'
  },
  {
    id: 'senaletica',
    nombre: 'señalética corporativa y de Defensa Civil',
    claves: ['senaletica', 'senalizacion', 'defensa civil', 'señal', 'evacuacion', 'extintor', 'zona segura', 'indeci'],
    pide: ['la cantidad de señales y qué tipos', 'las medidas por señal', 'el material (acrílico, vinil o PVC)'],
    nota: 'Cumplimos con la norma NTP 399.010 para señalética de Defensa Civil.'
  },
  {
    id: 'vinil',
    nombre: 'viniles decorativos y rotulado vehicular',
    claves: ['vinil', 'vinilo', 'rotulado', 'rotular', 'sticker', 'stickers', 'microperforado', 'esmerilado', 'vehicular', 'camioneta', 'furgon'],
    pide: ['las medidas o el modelo del vehículo', 'la cantidad', 'si el diseño ya está listo'],
    nota: 'Manejamos vinil adhesivo, microperforado, esmerilado y laminado de protección.'
  },
  {
    id: 'retail',
    nombre: 'implementación retail y mobiliario comercial',
    claves: ['mobiliario', 'melamina', 'modulo', 'góndola', 'gondola', 'stand', 'exhibidor', 'isla', 'mueble', 'vitrina', 'cnc', 'corte laser', 'totem', 'tótem'],
    pide: ['las medidas del módulo', 'la cantidad', 'el acabado o color de melamina', 'la ubicación de instalación'],
    nota: 'Fabricamos en melamina, MDF y acrílico, con corte láser y CNC de precisión.'
  },
  {
    id: 'impresion',
    nombre: 'impresión digital y UV',
    claves: ['impresion uv', 'uv', 'impresion digital', 'volante', 'volantes', 'folleto', 'afiche', 'tarjeta', 'catalogo', 'brochure', 'pop', 'display'],
    pide: ['el tamaño', 'la cantidad', 'el material o sustrato', 'si el arte ya está listo'],
    nota: 'Impresión UV directa sobre acrílico, MDF, foam y otros sustratos rígidos.'
  },
  {
    id: 'obra',
    nombre: 'servicios generales (drywall, pintura y acabados)',
    claves: ['drywall', 'pintura', 'pintar', 'acabado', 'remodelacion', 'oficina', 'servicios generales', 'implementacion'],
    pide: ['los metros cuadrados aproximados', 'la ubicación del local', 'la fecha en que necesitan iniciar'],
    nota: 'Realizamos decoración de oficinas, drywall, pintura y acabados en general.'
  }
]

const firma = () =>
  `\n\n${config.empresa.contacto}\n${config.empresa.nombre}\n${config.empresa.telefono}\n${config.empresa.correo}`

const primerNombre = (nombre = '') => {
  const n = String(nombre).trim().split(/\s+/)[0]
  return /^[\p{L}]{2,20}$/u.test(n) ? ` ${n}` : ''
}

/** Palabras que indican que el cliente pide precio. */
const PIDE_PRECIO = ['precio', 'costo', 'cuanto', 'cuánto', 'cotiza', 'cotización', 'cotizacion', 'presupuesto', 'tarifa', 'vale']
const SOLO_SALUDO = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|alo|aló|hi|holi|saludos)[\s!.,¡]*$/

/** Detecta a qué línea de negocio apunta el mensaje. */
export function detectarLinea (texto) {
  const t = norm(texto)
  let mejor = null
  let puntos = 0
  for (const linea of LINEAS) {
    const p = linea.claves.reduce((acc, c) => acc + (t.includes(norm(c)) ? 1 : 0), 0)
    if (p > puntos) { puntos = p; mejor = linea }
  }
  return mejor
}

export function fueraDeHorario (fecha = new Date()) {
  const hora = Number(
    new Intl.DateTimeFormat('es-PE', {
      timeZone: config.tz, hour: 'numeric', hour12: false
    }).format(fecha)
  )
  return hora < config.horario.inicio || hora >= config.horario.fin
}

/**
 * Redacta el borrador de respuesta para un mensaje entrante.
 * @returns {{texto: string, linea: string, motivo: string}}
 */
export function redactar (mensaje, { nombre = '', esPrimerContacto = true } = {}) {
  const saludo = `Hola${primerNombre(nombre)},`
  const t = norm(mensaje)
  const linea = detectarLinea(mensaje)
  const pidePrecio = PIDE_PRECIO.some(p => t.includes(norm(p)))

  // 1) Solo saludó: abrimos conversación y preguntamos qué necesita.
  if (SOLO_SALUDO.test(t.trim())) {
    return {
      linea: 'saludo',
      motivo: 'El cliente solo saludó',
      texto:
        `${saludo}\n\nGracias por escribir a ${config.empresa.nombre}\n\n` +
        'Cuéntanos qué necesitas y con gusto te preparamos una propuesta.\n\n' +
        'Trabajamos gigantografías, letras corpóreas, señalética, viniles, ' +
        'mobiliario comercial e implementación retail.' + firma()
    }
  }

  // 2) Identificamos la línea: pedimos los datos que faltan para cotizar.
  if (linea) {
    const faltan = linea.pide.map(p => `• ${p[0].toUpperCase()}${p.slice(1)}`).join('\n')
    return {
      linea: linea.id,
      motivo: pidePrecio
        ? 'Pide precio pero faltan datos para cotizar'
        : `Consulta sobre ${linea.nombre}`,
      texto:
        `${saludo}\n\nGracias por contactarte con ${config.empresa.nombre}\n\n` +
        `Sí trabajamos ${linea.nombre}. ${linea.nota}\n\n` +
        'Para pasarte una cotización exacta, indícanos por favor:\n' +
        `${faltan}\n\nCon esos datos te enviamos el presupuesto el mismo día.` + firma()
    }
  }

  // 3) Pide precio de algo que no identificamos: nunca inventamos cifras.
  if (pidePrecio) {
    return {
      linea: 'general',
      motivo: 'Pide precio sin especificar el trabajo',
      texto:
        `${saludo}\n\nCon gusto te cotizamos. Para darte un precio exacto ` +
        'necesitamos saber qué trabajo es, las medidas, la cantidad y la ubicación ' +
        'donde se instalaría.\n\nEnvíanos esos datos (o una foto de referencia) ' +
        'y te preparamos el presupuesto.' + firma()
    }
  }

  // 4) No lo entendemos: mejor que decida el dueño.
  return {
    linea: 'desconocida',
    motivo: 'No se identificó el requerimiento — conviene revisar a mano',
    texto:
      `${saludo}\n\nGracias por escribir a ${config.empresa.nombre}\n\n` +
      'Ya estamos revisando tu consulta y en breve te respondemos con el detalle.' + firma()
  }
}

export function avisoFueraDeHorario () {
  return (
    `Gracias por escribir a ${config.empresa.nombre}\n\n` +
    `Nuestro horario de atención es de ${config.horario.inicio}:00 a ${config.horario.fin}:00. ` +
    'Hemos recibido tu mensaje y te respondemos apenas iniciemos el día.'
  )
}

export const lineas = LINEAS
