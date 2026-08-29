import 'dotenv/config'

const num = (v, def) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

const soloDigitos = (v = '') => String(v).replace(/\D/g, '')

export const config = {
  numero: soloDigitos(process.env.WA_NUMERO || ''),
  login: (process.env.WA_LOGIN || 'codigo').toLowerCase() === 'qr' ? 'qr' : 'codigo',
  duenio: soloDigitos(process.env.WA_DUENIO || ''),
  modo: ['auto', 'aprobacion', 'manual'].includes(process.env.WA_MODO)
    ? process.env.WA_MODO
    : 'aprobacion',
  pausaMin: num(process.env.WA_PAUSA_MIN, 60),
  grupos: process.env.WA_GRUPOS === '1',
  empresa: {
    nombre: process.env.EMPRESA_NOMBRE || 'Rasterizar S.A.C.',
    contacto: process.env.EMPRESA_CONTACTO || 'Jorge Luis Pampas Sarmiento',
    telefono: process.env.EMPRESA_TELEFONO || '914858708',
    correo: process.env.EMPRESA_CORREO || 'proyectos@rasteriza.com'
  },
  horario: {
    inicio: num(process.env.HORARIO_INICIO, 8),
    fin: num(process.env.HORARIO_FIN, 19)
  },
  // Zona horaria de Perú, para el aviso de fuera de horario
  tz: 'America/Lima'
}

if (!config.numero) {
  console.error('\n[config] Falta WA_NUMERO en el archivo .env (ej: 51912980371)\n')
  process.exit(1)
}
