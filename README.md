# WhatsApp de Rasterizar S.A.C.

Bot de WhatsApp para el número **912 980 371**, con **Jorge al mando**: el bot
redacta, tú decides. Todo se controla desde tu propio celular, sin apps raras
ni paneles web.

---

## Lo importante primero

| Tu duda | Respuesta |
|---|---|
| ¿Pierdo mi número? | **No.** El bot entra como *dispositivo vinculado*, igual que WhatsApp Web. Tu WhatsApp sigue funcionando normal en el celular. |
| ¿Puedo seguir escribiendo yo? | **Sí.** Y si tú contestas a mano en un chat, el bot se calla solo en ese chat por 60 minutos. |
| ¿El bot manda cosas sin permiso? | **No**, en el modo por defecto (*aprobación*) te muestra el borrador y espera tu **ok**. |
| ¿Desde dónde lo manejo? | Desde tu chat **"Mensajes contigo mismo"** en WhatsApp. Ahí escribes `.menu` y sale el panel. |
| ¿Puedo apagarlo? | `.off` y no responde a nadie. `.on` y vuelve. |
| ¿Quién redacta? | **Claude**, con las reglas y los precios de Rasterizar — si conectas la API key. Sin ella, plantillas fijas. |

---

## Qué se instaló y por qué

El motor es **[Baileys](https://github.com/WhiskeySockets/Baileys)**
(WhiskeySockets), la librería que usan por debajo casi todos los proyectos
grandes de WhatsApp: Evolution API, WAHA, Chatwoot y demás.

Se comparó con las alternativas más conocidas de GitHub:

| Proyecto | ⭐ | Cómo funciona | Por qué sí / por qué no |
|---|---|---|---|
| **Baileys** | ~11 k | WebSocket puro | ✅ **El elegido.** Sin navegador, ~150 MB de RAM, arranca en segundos, aguanta bien en un VPS barato. Es el motor de casi todo lo demás. |
| whatsapp-web.js | ~22 k | Chrome automatizado | Tiene más estrellas, pero abre un Chrome completo (1–2 GB de RAM) y se rompe cada vez que WhatsApp Web cambia el HTML. Más estrellas ≠ más estable. |
| Evolution API | ~9 k | Servidor + Docker | Muy bueno si manejas muchos números y un equipo. Para un solo número es armar un camión para llevar una caja. Además usa Baileys por dentro. |
| WAHA | ~7 k | Docker, varios motores | Igual: capa extra encima de lo mismo. |
| whatsmeow | ~7 k | Go | Excelente, pero en Go: más difícil de tocar para hacerle cambios al bot. |

Traducido: **whatsapp-web.js tiene más estrellitas, pero Baileys es lo más
confiable para lo que necesitas.** Y las estrellitas de los demás en realidad
apuntan a Baileys, porque lo llevan adentro.

---

## Instalación (una sola vez)

Necesitas una computadora o un VPS con **Node.js 20 o superior** que quede
prendido. Si apagas la máquina, el bot deja de responder (tu WhatsApp del
celular sigue igual de normal).

```bash
git clone https://github.com/RASTERIZA/Rasterizar.git
cd Rasterizar
npm install
cp .env.example .env
```

Abre `.env` y revisa que diga tu número con el código de país, sin `+`:

```
WA_NUMERO=51912980371
```

### Vincular tu número

```bash
npm run vincular
```

Sale un código de 8 dígitos en pantalla. En tu celular:

> **WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo →
> "Vincular con número de teléfono"** → escribe el código.

Listo. Te llega un mensaje a tu propio chat con el panel de control.

> Si prefieres escanear un QR, pon `WA_LOGIN=qr` en el `.env`.

### Dejarlo prendido 24/7

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup     # revive solo si se reinicia el servidor
pm2 logs rasterizar-wa      # ver qué está haciendo
```

---

## Cómo se maneja desde tu celular

Abre en WhatsApp tu chat **"Mensajes contigo mismo"** (búscate a ti mismo en
la lista de contactos) y escribe los comandos ahí.

### Los tres modos

| Comando | Qué hace |
|---|---|
| `.modo aprobacion` | **Por defecto.** El bot redacta y te pide permiso. Nada sale sin tu ok. |
| `.modo auto` | Responde solo y te avisa de cada respuesta. |
| `.modo manual` | No responde nada, solo te avisa que llegó un mensaje. |

### Control diario

| Comando | Qué hace |
|---|---|
| `.menu` | Muestra el panel completo |
| `.estado` | Cómo está el bot, qué chats están en pausa, qué borradores esperan |
| `.on` / `.off` | Encender / apagar todo |
| `.pausa 51987654321 120` | Callar ese chat 120 minutos (lo atiendes tú) |
| `.reanudar 51987654321` | Volver a atenderlo automáticamente |
| `.enviar 51987654321 \| Buenos días, le escribo de Rasterizar` | Mandar un mensaje a un cliente. Ese chat queda en tus manos 60 min |
| `.cotiza 51987654321` | Claude relee ese chat y redacta la cotización |
| `.cotiza 51987654321 \| el m² va S/ 25` | Lo mismo, con tu instrucción |

### Cuando el bot te pide permiso

Te llega algo así:

```
🔔 Mensaje nuevo — borrador #7
👤 Ana Quispe · wa.me/51987654321
💬 "cuánto cuesta una gigantografía de 3x2"
🏷️ Pide precio pero faltan datos para cotizar
─────────────────────
Hola Ana,

Gracias por contactarte con Rasterizar S.A.C.

Sí trabajamos gigantografías e impresión de gran formato...
─────────────────────
Responde a este mensaje con ok, no, o el texto corregido.
```

**Responde citando ese mensaje** (mantén presionado → Responder) y escribe:

- **`ok`** → sale tal cual
- **`no`** → se descarta y el chat queda en pausa para que contestes tú
- **cualquier otro texto** → se envía **tu** texto en lugar del borrador

También sirve escribir `.ok 7`, `.no 7` o `.ok 7 texto corregido`.

---

## Que Claude redacte las cotizaciones

Esta es la parte importante. Con una API key de Anthropic, quien redacta ya no
es una plantilla: es Claude, leyendo **toda la conversación** con ese cliente y
**tus precios reales**.

### 1. Llena tus precios

Abre `negocio/precios.md` y reemplaza los `S/ __` por tus precios. Es la única
fuente que Claude puede usar para dar cifras. Formato libre — escribe como te
sea cómodo.

**Lo que no esté en ese archivo, Claude no lo inventa.** Te avisa a ti:

```
🔔 Mensaje nuevo — borrador #4
👤 Ana Quispe · wa.me/51987654321
💬 "cuánto el mesh"
🏷️ ⚠️ Claude necesita un precio que no está en tu lista
```

### 2. Pon la API key

Sácala en [console.anthropic.com](https://console.anthropic.com) y ponla en el
`.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Necesita crédito prepagado y **es aparte de tu suscripción de Claude**.
Referencia de costo con `claude-opus-5`: del orden de un céntimo de sol por
respuesta. Si quieres gastar menos, pon `WA_MODELO=claude-haiku-4-5`.

### 3. Dale la orden cuando quieras

Cuando llegue una consulta, Claude redacta solo y te pide el ok. Pero también
puedes tomar tú la iniciativa desde el celular:

```
.cotiza 51987654321
.cotiza 51987654321 | el m² de lona va S/ 25, agrégale instalación
.cotiza 51987654321 | dile que el descuento es 10% si paga al contado
```

Claude relee todo el hilo con ese cliente, aplica tu instrucción, y te devuelve
el borrador **al panel**. Nada sale sin tu ok.

Lo que apruebes (o tu corrección) queda en el historial, así Claude no vuelve a
pedir las medidas que el cliente ya dio.

### Si Claude se cae

Si la API falla —sin crédito, sin internet, lo que sea— el bot **no se queda
mudo**: contesta con la plantilla de siempre y el aviso te dice qué pasó.

---

## Qué responde sin Claude

Aun sin API key el bot funciona. Reconoce **gigantografías, letras corpóreas,
señalética de Defensa Civil, viniles y rotulado vehicular, mobiliario retail,
impresión UV y servicios generales**, y para cada línea pide los datos que
faltan para cotizar.

**Tampoco inventa precios**: pide los datos y te avisa.

Si llega una **foto, audio o documento sin texto**, el bot no adivina: te lo
pasa a ti y pausa ese chat.

---

## Cuidados importantes

- **No es la API oficial de WhatsApp.** Es el mismo mecanismo de WhatsApp Web
  (dispositivo vinculado). Meta no lo prohíbe expresamente para uso personal,
  pero tampoco lo respalda: si se le da un uso masivo, la cuenta se puede
  restringir. El bot ya trae protecciones (demora al escribir, nada de envíos
  masivos, no contesta grupos ni estados). **Úsalo para atender a quien te
  escribe, no para publicidad en frío.**
- **La carpeta `auth/` es tu sesión de WhatsApp.** Quien la copie puede leer y
  escribir por tu número. No la subas a GitHub (ya está en `.gitignore`) ni la
  compartas.
- **`data/historial.json` guarda las conversaciones con tus clientes** en texto
  plano, para que Claude tenga contexto. Está en `.gitignore`, pero tenlo en
  cuenta si compartes esa carpeta o haces respaldos.
- **La alternativa oficial** es la WhatsApp Cloud API de Meta, pero exige
  migrar el número fuera de la app: perderías usar el 912 980 371 desde tu
  celular. Por eso no se eligió.

---

## Si algo falla

| Problema | Qué hacer |
|---|---|
| El código de vinculación venció | `npm run vincular` de nuevo |
| Quiero vincular otro número | `npm run salir` y luego `npm run vincular` |
| "La sesión se cerró desde el celular" | Alguien desvinculó el dispositivo. `npm run salir` y vincular otra vez |
| El bot no responde | `.estado` en tu chat. Revisa que diga *encendido* y que el chat no esté en pausa |
| Ver qué está pasando | `pm2 logs rasterizar-wa` |

---

## Para el que toque el código

```
src/config.js         lee el .env
src/claude.js         llama a Claude con las reglas y precios de Rasterizar
src/claude-formato.js interpreta lo que Claude devuelve
src/comercial.js      plantillas de respaldo (catálogo y reglas de negocio)
src/historial.js      memoria de cada conversación
src/panel.js          los comandos que escribes desde el celular
src/bot.js            decide qué hacer con cada mensaje (sin tocar el socket)
src/wa.js             utilidades sobre los mensajes de Baileys
src/index.js          conexión, vinculación y reconexión
negocio/precios.md    tus precios — la única fuente de cifras
test/                 53 pruebas, sin conectarse a WhatsApp ni a la API
```

```bash
npm test
```

Para cambiar cómo redacta Claude, edita la función `instrucciones()` en
`src/claude.js`. Para las plantillas de respaldo, el arreglo `LINEAS` en
`src/comercial.js`.

Las pruebas usan un doble de Claude (`test/falso-claude.js`), así que corren
gratis y sin red.
