# Railway Environment Variables

Esta guía explica todas las variables de entorno que puedes configurar en Railway para usar el bot en diferentes servidores de Discord.

## 🔑 Variables Requeridas

Estas variables son **obligatorias** para que el bot funcione:

```env
BOT_TOKEN=tu_token_del_bot_de_discord
SA_API_KEY=tu_api_key_de_sellauth
SA_SHOP_ID=tu_shop_id_de_sellauth
```

## ⚙️ Variables Opcionales (Configuración Global)

Estas variables se aplican a **todos los servidores** donde el bot está presente. Si no las configuras, puedes usar el comando `/setup` en cada servidor para configurarlas individualmente.

### Roles (Opcional - se puede configurar con `/setup`)
```env
BOT_ADMIN_ROLE_ID=id_del_rol_de_admin
BOT_STAFF_ROLE_ID=id_del_rol_de_staff
BOT_CUSTOMER_ROLE_ID=id_del_rol_de_cliente
BOT_TRIAL_ADMIN_ROLE_ID=id_del_rol_de_trial_admin
```

### Canales (Opcional - se puede configurar con `/setup`)
```env
BOT_SPAM_CHANNEL_ID=id_del_canal_para_notificaciones_de_spam_y_bans
LOG_CHANNEL_ID=id_del_canal_para_logs_generales
```

### Otros
```env
BOT_GUILD_ID=id_del_servidor_principal (opcional, si no se define, los comandos se registran globalmente)
BOT_USER_ID_WHITELIST=id1,id2,id3 (IDs de usuarios separados por comas, opcional)
```

## 📋 Configuración por Servidor (Recomendado)

**La mejor forma** de configurar el bot para diferentes servidores es usar el comando `/setup` en cada servidor. Esto permite tener configuraciones diferentes para cada servidor.

### Usar `/setup` en cada servidor:

1. Solo el usuario con ID `1190738779015757914` puede usar este comando
2. Ejecuta `/setup` en el servidor donde quieres configurar el bot
3. Proporciona:
   - `admin_role`: Rol de administrador
   - `staff_role`: Rol de staff (trial staff)
   - `customer_role`: Rol de cliente (opcional)
   - `log_channel`: Canal para logs (opcional)
   - `transcript_channel`: Canal para transcripts de tickets (opcional)
   - `rating_channel`: Canal para ratings de tickets (opcional)
   - `trial_admin_role`: Rol de trial admin (opcional)
   - `spam_channel`: Canal para notificaciones de spam/bans (opcional)

## 🎯 Ejemplo de Configuración Completa

### Opción 1: Variables de Entorno (Global para todos los servidores)
```env
BOT_TOKEN=tu_token_aqui
SA_API_KEY=tu_api_key_aqui
SA_SHOP_ID=tu_shop_id_aqui
BOT_ADMIN_ROLE_ID=id_del_rol_admin
BOT_STAFF_ROLE_ID=id_del_rol_staff
BOT_SPAM_CHANNEL_ID=id_del_canal_spam
LOG_CHANNEL_ID=id_del_canal_logs
```

### Opción 2: Comando `/setup` (Por servidor - Recomendado)
1. Ejecuta `/setup` en cada servidor
2. Configura los roles y canales específicos de ese servidor
3. Cada servidor tendrá su propia configuración independiente

## 🔍 Cómo Obtener los IDs

### Obtener ID de un Rol:
1. Activa el "Modo Desarrollador" en Discord (Configuración > Avanzado > Modo Desarrollador)
2. Click derecho en el rol > "Copiar ID"

### Obtener ID de un Canal:
1. Activa el "Modo Desarrollador" en Discord
2. Click derecho en el canal > "Copiar ID"

### Obtener ID de un Usuario:
1. Activa el "Modo Desarrollador" en Discord
2. Click derecho en el usuario > "Copiar ID"

### Obtener ID del Servidor (Guild):
1. Activa el "Modo Desarrollador" en Discord
2. Click derecho en el nombre del servidor > "Copiar ID"

## 📝 Notas Importantes

- **Variables de Entorno vs `/setup`**: Las variables de entorno son globales (aplican a todos los servidores). El comando `/setup` permite configuraciones específicas por servidor.
- **Prioridad**: Si usas `/setup`, esa configuración tiene prioridad sobre las variables de entorno para ese servidor específico.
- **Multi-servidor**: El bot puede estar en múltiples servidores, cada uno con su propia configuración usando `/setup`.
- **Canal de Spam**: Este canal recibe notificaciones cuando:
  - Un usuario es baneado por spam de comandos
  - Un usuario es baneado manualmente con `/ban`
  - Cualquier acción de moderación importante

## 🚀 Configuración Rápida en Railway

1. Ve a tu proyecto en Railway
2. Abre la pestaña "Variables"
3. Agrega las variables requeridas (`BOT_TOKEN`, `SA_API_KEY`, `SA_SHOP_ID`)
4. Opcionalmente agrega las variables de configuración global
5. O usa `/setup` en cada servidor para configuraciones específicas

