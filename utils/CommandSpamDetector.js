import { Collection } from 'discord.js';

const SPAM_CHANNEL_ID = '1445838663786172619';
const SPAM_THRESHOLD = 2; // Más de 2 veces
const SPAM_TIME_WINDOW = 7000; // 7 segundos

// Almacenar historial de comandos por usuario
const commandHistory = new Collection();

export class CommandSpamDetector {
  /**
   * Verificar si un usuario está haciendo spam de comandos
   */
  static checkSpam(userId, commandName) {
    const key = `${userId}_${commandName}`;
    const now = Date.now();

    // Obtener historial del usuario para este comando
    if (!commandHistory.has(key)) {
      commandHistory.set(key, []);
    }

    const history = commandHistory.get(key);

    // Filtrar comandos fuera de la ventana de tiempo (7 segundos)
    const recentCommands = history.filter(timestamp => now - timestamp < SPAM_TIME_WINDOW);

    // Agregar este comando al historial
    recentCommands.push(now);
    commandHistory.set(key, recentCommands);

    // Si tiene más de 2 comandos en 7 segundos, es spam
    if (recentCommands.length > SPAM_THRESHOLD) {
      return {
        isSpam: true,
        count: recentCommands.length,
        timeWindow: SPAM_TIME_WINDOW
      };
    }

    return { isSpam: false };
  }

  /**
   * Limpiar historial antiguo (para evitar memory leaks)
   */
  static cleanup() {
    const now = Date.now();
    const maxAge = SPAM_TIME_WINDOW * 2; // Mantener 2x la ventana de tiempo

    for (const [key, history] of commandHistory.entries()) {
      const filtered = history.filter(timestamp => now - timestamp < maxAge);
      if (filtered.length === 0) {
        commandHistory.delete(key);
      } else {
        commandHistory.set(key, filtered);
      }
    }
  }

  /**
   * Obtener el ID del canal de spam
   */
  static getSpamChannelId() {
    return SPAM_CHANNEL_ID;
  }

  /**
   * Limpiar historial de un usuario específico
   */
  static clearUserHistory(userId) {
    for (const key of commandHistory.keys()) {
      if (key.startsWith(`${userId}_`)) {
        commandHistory.delete(key);
      }
    }
  }
}

// Limpiar historial cada 5 minutos
setInterval(() => {
  CommandSpamDetector.cleanup();
}, 5 * 60 * 1000);

