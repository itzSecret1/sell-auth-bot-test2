# 🚂 Guía Completa: Configurar el Bot en Railway

Esta guía te ayudará a configurar el bot de Discord en Railway paso a paso.

## 📋 Requisitos Previos

1. ✅ Token del bot de Discord
2. ✅ API Key de SellAuth
3. ✅ Shop ID de SellAuth
4. ✅ Cuenta de Railway (gratis en [railway.app](https://railway.app))
5. ✅ Repositorio en GitHub (ya lo tienes: `itzSecret1/sell-auth-bot-test2`)

---

## 🔑 Paso 1: Obtener el Token del Bot

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecciona tu aplicación (o crea una nueva)
3. Ve a la sección **"Bot"** en el menú lateral
4. Haz clic en **"Reset Token"** o copia el token existente
5. ⚠️ **IMPORTANTE**: Guarda este token en un lugar seguro, no lo compartas

---

## 🚀 Paso 2: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) e inicia sesión (puedes usar GitHub)
2. Haz clic en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza Railway para acceder a tu GitHub si es necesario
5. Selecciona el repositorio: `itzSecret1/sell-auth-bot-test2`
6. Railway detectará automáticamente que es un proyecto Node.js

---

## ⚙️ Paso 3: Configurar Variables de Entorno

Una vez que Railway haya clonado tu repositorio:

1. En tu proyecto de Railway, haz clic en el servicio (service)
2. Ve a la pestaña **"Variables"**
3. Haz clic en **"New Variable"** y agrega las siguientes variables:

### 🔴 Variables OBLIGATORIAS (debes agregarlas):

```env
BOT_TOKEN=tu_token_del_bot_aqui
SA_API_KEY=tu_api_key_de_sellauth
SA_SHOP_ID=tu_shop_id_de_sellauth
```

### 🟡 Variables OPCIONALES (puedes agregarlas después o usar `/setup`):

```env
BOT_ADMIN_ROLE_ID=id_del_rol_admin
BOT_STAFF_ROLE_ID=id_del_rol_staff
BOT_CUSTOMER_ROLE_ID=id_del_rol_cliente
BOT_TRIAL_ADMIN_ROLE_ID=id_del_rol_trial_admin
BOT_SPAM_CHANNEL_ID=id_del_canal_spam
LOG_CHANNEL_ID=id_del_canal_logs
```

**Nota**: Si no agregas las variables opcionales, puedes configurarlas después usando el comando `/setup start` en Discord.

---

## 📦 Paso 4: Configurar el Build y Start Commands

Railway debería detectar automáticamente que es un proyecto Node.js, pero verifica:

1. En la pestaña **"Settings"** de tu servicio
2. Verifica que:
   - **Build Command**: `npm install` (o se detecta automáticamente)
   - **Start Command**: `node index.js` (o `npm start`)

---

## 🎯 Paso 5: Desplegar el Bot

1. Una vez configuradas las variables de entorno, Railway comenzará a desplegar automáticamente
2. Puedes ver el progreso en la pestaña **"Deployments"**
3. Revisa los logs en la pestaña **"Logs"** para ver si hay errores

---

## ✅ Paso 6: Verificar que el Bot Funciona

1. Ve a tu servidor de Discord
2. Verifica que el bot esté en línea (debería aparecer como "Online" en la lista de miembros)
3. Prueba ejecutando `/setup start` (solo usuarios autorizados: `1190738779015757914` o `1407024330633642005`)

---

## 🔧 Paso 7: Configurar el Bot en tu Servidor (Opcional)

### Opción A: Usar el comando `/setup start` (Recomendado)

1. Ejecuta `/setup start` en tu servidor de Discord
2. Sigue la guía interactiva paso a paso
3. El bot te explicará cada opción y te pedirá los IDs

### Opción B: Usar variables de entorno en Railway

Si prefieres configurar todo desde Railway, agrega todas las variables opcionales en la pestaña "Variables".

---

## 🐛 Solución de Problemas

### El bot no se conecta

1. Verifica que `BOT_TOKEN` esté correcto en Railway
2. Revisa los logs en Railway para ver errores
3. Asegúrate de que el bot tenga los permisos necesarios en Discord

### Error: "Missing Permissions"

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Ve a **"OAuth2" > "URL Generator"**
3. Selecciona los scopes: `bot` y `applications.commands`
4. Selecciona los permisos necesarios:
   - Send Messages
   - Embed Links
   - Manage Channels
   - Manage Roles
   - Ban Members
   - View Channels
5. Copia la URL generada y ábrela en tu navegador
6. Invita el bot a tu servidor con estos permisos

### El bot no responde a comandos

1. Verifica que el bot esté en línea
2. Revisa los logs en Railway
3. Asegúrate de que hayas configurado los roles correctamente con `/setup start`

---

## 📝 Resumen de Variables de Entorno

### Mínimas Requeridas:
- `BOT_TOKEN` - Token del bot de Discord
- `SA_API_KEY` - API Key de SellAuth
- `SA_SHOP_ID` - Shop ID de SellAuth

### Opcionales (puedes configurarlas con `/setup start`):
- `BOT_ADMIN_ROLE_ID` - Rol de administrador
- `BOT_STAFF_ROLE_ID` - Rol de staff
- `BOT_CUSTOMER_ROLE_ID` - Rol de cliente
- `BOT_TRIAL_ADMIN_ROLE_ID` - Rol de trial admin
- `BOT_SPAM_CHANNEL_ID` - Canal para notificaciones de spam/bans
- `LOG_CHANNEL_ID` - Canal para logs

---

## 🎉 ¡Listo!

Una vez completados estos pasos, tu bot debería estar funcionando en Railway. 

**Recuerda**: Puedes configurar todo desde Discord usando `/setup start` sin necesidad de agregar todas las variables en Railway.

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs en Railway
2. Verifica que todas las variables obligatorias estén configuradas
3. Asegúrate de que el bot tenga los permisos necesarios en Discord

