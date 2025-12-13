import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const VOUCHES_FILE = './vouches.json';
const BACKUPS_DIR = './vouches_backups';

function getBackupFiles() {
  try {
    if (!existsSync(BACKUPS_DIR)) {
      return [];
    }
    const files = readdirSync(BACKUPS_DIR)
      .filter(file => file.startsWith('vouches_backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Más recientes primero
    return files;
  } catch (error) {
    console.error('[VOUCHES-RESTORE] Error reading backup files:', error);
    return [];
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('vouches-restore')
    .setDescription('Restore vouches from a backup file')
    .addStringOption((option) =>
      option
        .setName('backup_file')
        .setDescription('Name of the backup file to restore (use autocomplete)')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async autocomplete(interaction) {
    const backupFiles = getBackupFiles();
    
    const focusedValue = interaction.options.getFocused();
    const filtered = backupFiles
      .filter(file => file.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(
      filtered.map(file => ({
        name: file,
        value: file
      }))
    );
  },

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const backupFileName = interaction.options.getString('backup_file');
      const backupPath = join(BACKUPS_DIR, backupFileName);

      if (!existsSync(backupPath)) {
        await interaction.editReply({
          content: `❌ Backup file not found: ${backupFileName}`
        });
        return;
      }

      // Leer backup
      const backupData = JSON.parse(readFileSync(backupPath, 'utf-8'));
      const vouchesCount = backupData.vouches?.length || 0;

      if (vouchesCount === 0) {
        await interaction.editReply({
          content: '❌ The backup file is empty'
        });
        return;
      }

      // Hacer backup del estado actual antes de restaurar
      let currentData;
      try {
        currentData = JSON.parse(readFileSync(VOUCHES_FILE, 'utf-8'));
      } catch (readError) {
        currentData = { vouches: [], nextNumber: 1 };
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackup = join(BACKUPS_DIR, `pre_restore_${timestamp}.json`);
      writeFileSync(preRestoreBackup, JSON.stringify(currentData, null, 2), 'utf-8');

      // Restaurar vouches
      writeFileSync(VOUCHES_FILE, JSON.stringify(backupData, null, 2), 'utf-8');

      // Crear lista de vouches restaurados (primeros 20)
      const vouchesList = backupData.vouches?.slice(0, 20).map((v, idx) => {
        const vouchInfo = v.message ? 
          `#${v.id}: ${v.message.substring(0, 50)}${v.message.length > 50 ? '...' : ''} (${v.stars || v.rating || 'N/A'}⭐)` :
          `#${v.id}: ${v.product || 'N/A'} ${v.value || ''} (${v.stars || v.rating || 'N/A'}⭐)`;
        return `${idx + 1}. ${vouchInfo}`;
      }).join('\n') || 'No vouches found';

      // Enviar mensaje simple de restauración (como cuando se crea un vouch)
      const restoreEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Vouches Restored')
        .setDescription(`**${vouchesCount}** vouches have been restored from backup.`)
        .addFields(
          {
            name: '📁 Backup File',
            value: `\`${backupFileName}\``,
            inline: true
          },
          {
            name: '👤 Restored by',
            value: `<@${interaction.user.id}>`,
            inline: true
          },
          {
            name: '📅 Restore Date',
            value: `<t:${Math.floor(new Date().getTime() / 1000)}:F>`,
            inline: true
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
          text: `Powered by SellAuth Bot • Restored by ${interaction.user.username}`,
          iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [restoreEmbed]
      });

      console.log(`[VOUCHES-RESTORE] ✅ Vouches restored from ${backupFileName} (${vouchesCount} vouches) by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('[VOUCHES-RESTORE] Error:', error);
      await interaction.editReply({
        content: `❌ Error restoring vouches: ${error.message}`
      }).catch(() => {});
    }
  }
};

