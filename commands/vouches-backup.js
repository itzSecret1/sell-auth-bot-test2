import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const VOUCHES_FILE = './vouches.json';
const BACKUPS_DIR = './vouches_backups';

// Crear directorio de backups si no existe
if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true });
}

function loadVouches() {
  try {
    if (existsSync(VOUCHES_FILE)) {
      const data = readFileSync(VOUCHES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[VOUCHES-BACKUP] Error loading vouches:', error);
  }
  return { vouches: [], nextNumber: 1 };
}

function saveBackup(vouchesData) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `vouches_backup_${timestamp}.json`;
    const backupPath = join(BACKUPS_DIR, backupFileName);
    
    writeFileSync(backupPath, JSON.stringify(vouchesData, null, 2), 'utf-8');
    return backupFileName;
  } catch (error) {
    console.error('[VOUCHES-BACKUP] Error saving backup:', error);
    throw error;
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup system commands')
    .addSubcommand((sub) =>
      sub
        .setName('vouches')
        .setDescription('Backup all vouches to a file')
    ),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'vouches') {
        const vouchesData = loadVouches();
        const totalVouches = vouchesData.vouches.length;

        if (totalVouches === 0) {
          await interaction.editReply({
            content: '❌ No hay vouches para hacer backup'
          });
          return;
        }

        const backupFileName = saveBackup(vouchesData);

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Vouches Backup Created')
          .addFields(
            {
              name: '📦 Total Vouches',
              value: totalVouches.toString(),
              inline: true
            },
            {
              name: '📁 Backup File',
              value: backupFileName,
              inline: false
            },
            {
              name: '📅 Backup Date',
              value: `<t:${Math.floor(new Date().getTime() / 1000)}:F>`,
              inline: true
            }
          )
          .setFooter({ text: 'Backup saved successfully' })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });

        console.log(`[VOUCHES-BACKUP] ✅ Backup creado: ${backupFileName} (${totalVouches} vouches)`);
      }

    } catch (error) {
      console.error('[VOUCHES-BACKUP] Error:', error);
      await interaction.editReply({
        content: `❌ Error al crear backup: ${error.message}`
      }).catch(() => {});
    }
  }
};

