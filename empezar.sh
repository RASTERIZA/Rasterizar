#!/usr/bin/env bash
#
# Instalación completa en un solo comando. Funciona en Mac y en Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/RASTERIZA/Rasterizar/claude/whatsapp-github-install-w63efe/empezar.sh | bash
#
# Crea la carpeta, descarga el proyecto, instala todo, te pregunta tus
# precios y te lleva hasta la vinculación del celular.

set -uo pipefail

REPO="https://github.com/RASTERIZA/Rasterizar"
RAMA="claude/whatsapp-github-install-w63efe"
CARPETA="${CARPETA:-$HOME/Rasterizar-WhatsApp}"

azul()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
verde() { printf '\033[1;32m  ✓ %s\033[0m\n' "$*"; }
rojo()  { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; }
gris()  { printf '\033[0;90m    %s\033[0m\n' "$*"; }

# Para poder preguntarte cosas aunque el script llegue por una tubería
if { : < /dev/tty; } 2>/dev/null; then ENTRADA=/dev/tty; else ENTRADA=/dev/stdin; fi

case "$(uname -s)" in
  Darwin) SISTEMA="Mac" ;;
  Linux)  SISTEMA="Linux" ;;
  *)      SISTEMA="$(uname -s)" ;;
esac

clear 2>/dev/null || true
cat <<INTRO
════════════════════════════════════════════════════════════
  BOT DE WHATSAPP — RASTERIZAR S.A.C.
  Instalación en $SISTEMA
════════════════════════════════════════════════════════════

Voy a crear la carpeta y dejar todo listo.
Carpeta: $CARPETA

INTRO

# ─────────────────────────────────────────────────────── Node.js
azul "1/4  Node.js"
necesita_node=1
if command -v node >/dev/null 2>&1; then
  mayor="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${mayor:-0}" -ge 20 ] 2>/dev/null; then
    verde "Ya lo tienes: $(node -v)"
    necesita_node=0
  else
    gris "Tienes $(node -v), hace falta la 20 o superior."
  fi
fi

if [ "$necesita_node" -eq 1 ]; then
  if command -v brew >/dev/null 2>&1; then
    gris "Instalando con Homebrew, esto tarda un poco..."
    brew install node && verde "Instalado: $(node -v)"
  elif command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
    verde "Instalado: $(node -v)"
  else
    rojo "No pude instalar Node.js solo."
    echo
    gris "Descárgalo aquí (elige la versión LTS, es un instalador normal):"
    gris "    https://nodejs.org"
    echo
    gris "Cuando termine, CIERRA esta ventana de Terminal, abre una nueva"
    gris "y vuelve a pegar el mismo comando."
    exit 1
  fi
fi

# ─────────────────────────────────────────────────────── git
azul "2/4  Descargando el proyecto"
if ! command -v git >/dev/null 2>&1; then
  if [ "$SISTEMA" = "Mac" ]; then
    rojo "Falta git. macOS lo instala solo:"
    gris "Va a salir una ventana pidiendo instalar las Herramientas de Línea"
    gris "de Comandos. Dale Instalar, espera, y vuelve a pegar el comando."
    xcode-select --install 2>/dev/null || true
    exit 1
  fi
  sudo apt-get update && sudo apt-get install -y git
fi

if [ -d "$CARPETA/.git" ]; then
  gris "La carpeta ya existía, la actualizo..."
  git -C "$CARPETA" fetch --quiet origin "$RAMA" && git -C "$CARPETA" checkout --quiet "$RAMA" && git -C "$CARPETA" pull --quiet origin "$RAMA"
else
  git clone --quiet --branch "$RAMA" "$REPO" "$CARPETA" || { rojo "No pude descargar el proyecto. ¿Tienes internet?"; exit 1; }
fi
cd "$CARPETA" || exit 1
verde "Listo en $CARPETA"

# ─────────────────────────────────────────────────────── dependencias
azul "3/4  Instalando dependencias"
gris "Tarda uno o dos minutos..."
npm install --omit=dev --no-audit --no-fund --silent || { rojo "Falló npm install. Pégame el error."; exit 1; }
verde "Listas"

# ─────────────────────────────────────────────────────── configuración
azul "4/4  Tus precios y tu clave"
echo
read -r -p "  ¿Configuramos ahora tus precios? (s/n): " ahora < "$ENTRADA" || ahora="n"
case "${ahora:-}" in
  [sS]*) bash configurar.sh ;;
  *)     gris "Lo dejamos para después: cd \"$CARPETA\" && bash configurar.sh" ;;
esac

# ─────────────────────────────────────────────────────── final
cat <<FIN

════════════════════════════════════════════════════════════
  TODO INSTALADO
════════════════════════════════════════════════════════════

Tu carpeta:  $CARPETA

Falta el último paso, que solo puedes hacer tú desde el celular:

    cd "$CARPETA"
    npm run vincular

Sale un código de 8 dígitos. En tu WhatsApp:
    Ajustes → Dispositivos vinculados → Vincular dispositivo
    → "Vincular con número de teléfono" → escribes el código

─────────────────────────────────────────────────────────────
 Comandos que vas a usar después, desde esa carpeta:

   npm start              arrancar el bot
   bash configurar.sh     cambiar precios
   npm run salir          desvincular para empezar de nuevo
FIN

if [ "$SISTEMA" = "Mac" ]; then
cat <<'MAC'

 En Mac, el bot solo responde mientras la laptop esté despierta.
 Déjala enchufada, con la tapa abierta, y en otra ventana de Terminal:

   caffeinate -dimsu

 Cuando quieras que funcione 24/7 sin depender de la laptop, lo
 movemos a un servidor. Son los mismos pasos allá.
MAC
fi
echo
