#!/usr/bin/env bash
# Dice en qué estado está la instalación. No cambia nada.
cd "$(dirname "$0")" || exit 1
ok(){ printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
no(){ printf '  \033[1;31m✗\033[0m %s\n' "$*"; }
printf '\n\033[1;34m── Estado del bot de Rasterizar ──\033[0m\n\n'

command -v node >/dev/null && ok "Node.js $(node -v)" || no "Node.js no instalado"
[ -d node_modules ] && ok "Dependencias instaladas" || no "Faltan dependencias — corre: npm install"

if [ -d auth ] && [ -n "$(ls -A auth 2>/dev/null)" ]; then
  ok "WhatsApp VINCULADO"
else
  no "WhatsApp sin vincular — corre: npm run vincular"
fi

if [ -f .env ] && grep -qE '^ANTHROPIC_API_KEY=.+' .env; then
  ok "Clave de Claude puesta (redacta Claude)"
else
  no "Sin clave de Claude — responde con plantillas. Corre: bash configurar.sh"
fi

# grep -c ya imprime 0 cuando no encuentra nada, y sale con código 1:
# un "|| echo 0" añadiría un segundo cero y rompería la comparación.
n=$(grep -cE 'S/ [0-9]' negocio/precios.md 2>/dev/null); n=${n:-0}
if [ "$n" -gt 0 ]; then ok "$n precios cargados"; else no "Sin precios — corre: bash configurar.sh"; fi

# Buscamos un proceso `node` de verdad. Un pgrep -f suelto se encuentra a
# sí mismo cuando el propio comando lleva "src/index.js" en su línea.
if ps -eo args= 2>/dev/null | grep -E '(^|/)node .*src/index\.js' | grep -qvE 'grep|revisar'; then
  ok "El bot está CORRIENDO ahora mismo"
else
  no "El bot no está corriendo — corre: npm start"
fi
printf '\n'
