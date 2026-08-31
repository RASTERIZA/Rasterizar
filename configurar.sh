#!/usr/bin/env bash
#
# Asistente de configuración: te pregunta lo que falta y escribe los archivos.
# Reemplaza tener que editar precios.md y .env a mano.
#
#   bash configurar.sh

set -uo pipefail
cd "$(dirname "$0")"

PRECIOS="negocio/precios.md"
ENV=".env"

azul()  { printf '\n\033[1;34m%s\033[0m\n' "$*"; }
gris()  { printf '\033[0;90m%s\033[0m\n' "$*"; }
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }

# De dónde leer: el terminal cuando lo hay (así funciona con `curl | bash`),
# la entrada estándar cuando no (así se puede probar con un pipe).
# Ojo: /dev/tty puede existir y aun así no poder abrirse (contenedores sin
# terminal). Hay que intentar abrirlo de verdad, no solo preguntar si existe.
if { : < /dev/tty; } 2>/dev/null; then ENTRADA=/dev/tty; else ENTRADA=/dev/stdin; fi

# Guarda cada respuesta en RESP[clave]. Enter = dejar en blanco.
# CONTADAS lleva la cuenta aparte: con `set -u`, bash revienta al medir
# el tamaño de un arreglo asociativo vacío.
declare -A RESP
CONTADAS=0

preguntar () {  # preguntar <clave> <texto> [sufijo]
  local clave="$1" texto="$2" sufijo="${3:-}" valor=""
  read -r -p "   $texto: " valor < "$ENTRADA" || valor=""
  valor="$(echo "${valor:-}" | tr -d '[:space:]')"
  if [ -n "$valor" ]; then
    RESP["$clave"]="${valor}${sufijo}"
    CONTADAS=$((CONTADAS + 1))
  fi
  return 0
}

# Escribe una fila de tabla solo si hay respuesta
fila () {  # fila <clave> <descripción> <unidad>
  local clave="$1"
  [ -n "${RESP[$clave]:-}" ] && printf '| %s | %s | S/ %s |\n' "$2" "$3" "${RESP[$clave]}" >> "$PRECIOS"
}

clear 2>/dev/null || true
cat <<'INTRO'
════════════════════════════════════════════════════════════
  CONFIGURACIÓN — Bot de WhatsApp de Rasterizar
════════════════════════════════════════════════════════════

Te voy a preguntar tus precios. Escribe solo el número (sin "S/").

Si un precio no lo sabes ahora o no lo trabajas, deja en blanco y
pulsa Enter: Claude te lo va a preguntar a ti cuando haga falta,
en vez de inventarlo.

INTRO
read -r _ < "$ENTRADA" || true

# ─────────────────────────────────────────────── precios
azul "GIGANTOGRAFÍAS  (precio por m²)"
preguntar lona_front  "Lona front impresa"
preguntar lona_mesh   "Lona mesh"
preguntar vinil_imp   "Vinil adhesivo impreso"
preguntar instalacion "Instalación por m²"

azul "LETRAS Y CAJAS DE LUZ"
preguntar letra_sin  "Letra corpórea acrílico SIN luz, hasta 30 cm (por letra)"
preguntar letra_led  "Letra corpórea acrílico CON LED (por letra)"
preguntar caja_luz   "Caja de luz (por m²)"

azul "SEÑALÉTICA  (medida 20x30 cm)"
preguntar senal_pvc  "Señal vinil sobre PVC (por unidad)"
preguntar senal_acri "Señal de acrílico (por unidad)"

azul "VINILES Y ROTULADO"
preguntar vinil_corte "Vinil de corte (por m²)"
preguntar rotulado    "Rotulado de auto completo (por servicio)"

azul "MOBILIARIO E IMPRESIÓN"
preguntar melamina "Módulo de melamina 18 mm (por m²)"
preguntar uv_acri  "Impresión UV sobre acrílico (por m²)"

azul "CONDICIONES COMERCIALES"
preguntar dias     "Días hábiles de entrega estándar"
preguntar adelanto "Porcentaje de adelanto"
igv=""
read -r -p "   ¿Los precios que diste INCLUYEN IGV? (s/n): " igv < "$ENTRADA" || igv=""

# ─────────────────────────────────────────────── escribir precios.md
if [ "$CONTADAS" -eq 0 ]; then
  printf '\n\033[1;31m%s\033[0m\n' "No respondiste ningún precio: dejo $PRECIOS como estaba."
  printf '%s\n\n' "Vuelve a correr 'bash configurar.sh' cuando los tengas a mano."
  exit 0
fi

# Respaldo antes de reescribir, por si te arrepientes
[ -f "$PRECIOS" ] && cp "$PRECIOS" "$PRECIOS.respaldo"
mkdir -p negocio

{
  echo "# Precios base — Rasterizar S.A.C."
  echo
  echo "> Generado por configurar.sh. Puedes editarlo a mano cuando quieras."
  echo "> Lo que no esté aquí, Claude NO lo inventa: te lo pregunta a ti."
  echo
} > "$PRECIOS"

if [ -n "${RESP[lona_front]:-}${RESP[lona_mesh]:-}${RESP[vinil_imp]:-}${RESP[instalacion]:-}" ]; then
  { echo "## Gigantografías e impresión gran formato"; echo; echo "| Material | Unidad | Precio |"; echo "|---|---|---|"; } >> "$PRECIOS"
  fila lona_front  "Lona front impresa"    "m²"
  fila lona_mesh   "Lona mesh"             "m²"
  fila vinil_imp   "Vinil adhesivo impreso" "m²"
  fila instalacion "Instalación"           "m²"
  echo >> "$PRECIOS"
fi

if [ -n "${RESP[letra_sin]:-}${RESP[letra_led]:-}${RESP[caja_luz]:-}" ]; then
  { echo "## Letras corpóreas y cajas de luz"; echo; echo "| Tipo | Unidad | Precio |"; echo "|---|---|---|"; } >> "$PRECIOS"
  fila letra_sin "Letra corpórea acrílico sin luz (hasta 30 cm)" "letra"
  fila letra_led "Letra corpórea acrílico con LED"               "letra"
  fila caja_luz  "Caja de luz"                                   "m²"
  echo >> "$PRECIOS"
fi

if [ -n "${RESP[senal_pvc]:-}${RESP[senal_acri]:-}" ]; then
  { echo "## Señalética (Defensa Civil / corporativa)"; echo; echo "| Tipo | Medida | Precio |"; echo "|---|---|---|"; } >> "$PRECIOS"
  fila senal_pvc  "Señal vinil sobre PVC" "20x30 cm"
  fila senal_acri "Señal de acrílico"     "20x30 cm"
  echo >> "$PRECIOS"
fi

if [ -n "${RESP[vinil_corte]:-}${RESP[rotulado]:-}" ]; then
  { echo "## Viniles y rotulado vehicular"; echo; echo "| Trabajo | Unidad | Precio |"; echo "|---|---|---|"; } >> "$PRECIOS"
  fila vinil_corte "Vinil de corte"           "m²"
  fila rotulado    "Rotulado de auto completo" "servicio"
  echo >> "$PRECIOS"
fi

if [ -n "${RESP[melamina]:-}${RESP[uv_acri]:-}" ]; then
  { echo "## Mobiliario e impresión"; echo; echo "| Trabajo | Unidad | Precio |"; echo "|---|---|---|"; } >> "$PRECIOS"
  fila melamina "Módulo de melamina 18 mm"   "m²"
  fila uv_acri  "Impresión UV sobre acrílico" "m²"
  echo >> "$PRECIOS"
fi

{
  echo "## Condiciones comerciales"
  echo
  [ -n "${RESP[dias]:-}" ]     && echo "- Tiempo de entrega estándar: ${RESP[dias]} días hábiles"
  [ -n "${RESP[adelanto]:-}" ] && echo "- Forma de pago: ${RESP[adelanto]}% de adelanto, saldo contra entrega"
  case "${igv:-}" in
    [sS]*) echo "- Los precios de arriba YA INCLUYEN IGV." ;;
    [nN]*) echo "- Los precios de arriba NO incluyen IGV (agregar 18%)." ;;
  esac
  echo
  echo "## Notas para Claude"
  echo
  echo "- Si el trabajo no está en esta lista, no inventes un precio:"
  echo "  responde NECESITO_A_JORGE y dile qué falta cotizar."
  echo "- Si faltan medidas o cantidad, pídelas antes de dar cualquier cifra."
  echo "- Muestra el desglose (material × metros, instalación aparte, total)."
} >> "$PRECIOS"

verde "✓ Precios guardados en $PRECIOS"

# ─────────────────────────────────────────────── clave de Claude
azul "CLAVE DE CLAUDE"
gris "   Se saca en https://console.anthropic.com (necesita crédito cargado)."
gris "   Sin ella el bot funciona igual, pero con respuestas de plantilla."
gris "   No se ve mientras la escribes. Enter para omitir."
clave=""
read -r -s -p "   Pega tu ANTHROPIC_API_KEY: " clave < "$ENTRADA" || clave=""
echo
[ -f "$ENV" ] || cp .env.example "$ENV"
if [ -n "${clave:-}" ]; then
  if grep -q '^ANTHROPIC_API_KEY=' "$ENV"; then
    tmp="$(mktemp)"
    grep -v '^ANTHROPIC_API_KEY=' "$ENV" > "$tmp"
    printf 'ANTHROPIC_API_KEY=%s\n' "$clave" >> "$tmp"
    mv "$tmp" "$ENV"
  else
    printf 'ANTHROPIC_API_KEY=%s\n' "$clave" >> "$ENV"
  fi
  chmod 600 "$ENV"
  verde "✓ Clave guardada en $ENV (solo tú puedes leerlo)"
else
  gris "   Omitida. Se usarán las plantillas."
fi

# ─────────────────────────────────────────────── resumen
azul "LISTO — así quedaron tus precios:"
echo
sed 's/^/   /' "$PRECIOS"
echo
cat <<'FIN'
════════════════════════════════════════════════════════════
  Falta un solo paso: vincular tu WhatsApp
════════════════════════════════════════════════════════════

  npm run vincular

Sale un código de 8 dígitos. En tu celular:
  WhatsApp → Ajustes → Dispositivos vinculados
  → Vincular dispositivo → "Vincular con número de teléfono"

Cuando diga "Conectado", corta con Ctrl+C y déjalo 24/7:
  pm2 start ecosystem.config.cjs && pm2 save

Para cambiar un precio después:  bash configurar.sh
FIN
