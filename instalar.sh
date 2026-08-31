#!/usr/bin/env bash
#
# Instala el bot de WhatsApp de Rasterizar en un servidor Ubuntu/Debian limpio.
#
#   bash instalar.sh
#
# Deja todo listo salvo dos cosas que solo puede hacer Jorge:
# llenar los precios y vincular el celular.

set -euo pipefail

REPO="https://github.com/RASTERIZA/Rasterizar"
RAMA="claude/whatsapp-github-install-w63efe"
DESTINO="${HOME}/rasterizar-whatsapp"

azul()  { printf '\n\033[1;34m%s\033[0m\n' "$*"; }
verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
rojo()  { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

if [ "$(id -u)" -eq 0 ] && [ -z "${PERMITIR_ROOT:-}" ]; then
  rojo "Estás como root. Es mejor crear un usuario normal:"
  rojo "  adduser rasterizar && usermod -aG sudo rasterizar && su - rasterizar"
  rojo "Si aun así quieres seguir: PERMITIR_ROOT=1 bash instalar.sh"
  exit 1
fi

# ---------------------------------------------------------------- 1. Node.js
azul "1/5  Node.js"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then
  verde "     Ya está: $(node -v)"
else
  echo "     Instalando Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  verde "     Listo: $(node -v)"
fi

# ------------------------------------------------------------------- 2. git
azul "2/5  git"
if command -v git >/dev/null 2>&1; then
  verde "     Ya está"
else
  sudo apt-get update && sudo apt-get install -y git
  verde "     Listo"
fi

# --------------------------------------------------------------- 3. proyecto
azul "3/5  Descargando el proyecto"
if [ -d "$DESTINO/.git" ]; then
  echo "     Ya existía, actualizando..."
  git -C "$DESTINO" fetch origin "$RAMA"
  git -C "$DESTINO" checkout "$RAMA"
  git -C "$DESTINO" pull origin "$RAMA"
else
  git clone --branch "$RAMA" "$REPO" "$DESTINO"
fi
cd "$DESTINO"
verde "     En $DESTINO"

# ----------------------------------------------------------- 4. dependencias
azul "4/5  Dependencias"
npm install --omit=dev --no-audit --no-fund
[ -f .env ] || cp .env.example .env
verde "     Listas"

# ------------------------------------------------------------------- 5. pm2
azul "5/5  pm2 (para que reviva solo si el servidor se reinicia)"
if command -v pm2 >/dev/null 2>&1; then
  verde "     Ya está"
else
  sudo npm install -g pm2
  verde "     Listo"
fi

# ---------------------------------------------------------------- siguiente
cat <<TEXTO

════════════════════════════════════════════════════════════════
  INSTALACIÓN TERMINADA
════════════════════════════════════════════════════════════════

Ahora corre el asistente. Te pregunta tus precios y tu clave de
Claude, y escribe los archivos por ti (no tienes que editar nada
a mano):

   cd $DESTINO && bash configurar.sh

Y al terminar, el único paso que nadie puede hacer por ti:

   npm run vincular

   Sale un código de 8 dígitos. En tu celular:
   WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo
   → "Vincular con número de teléfono" → escribe el código.

   Cuando diga "Conectado", corta con Ctrl+C y déjalo corriendo 24/7:

     pm2 start ecosystem.config.cjs
     pm2 save
     pm2 startup     (y pega el comando que te muestre)

Para ver qué está haciendo:   pm2 logs rasterizar-wa
Para apagarlo:                pm2 stop rasterizar-wa

TEXTO
