import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from '../utils/config.js';

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

      // Obtener canal de vouches si está configurado
      const { GuildConfig } = await import('../utils/GuildConfig.js');
      const guildConfig = GuildConfig.getConfig(interaction.guild.id);
      const vouchesChannelId = guildConfig?.vouchesChannelId;
      
      // Obtener canal donde enviar los vouches (canal de vouches o canal actual)
      let targetChannel = interaction.channel;
      if (vouchesChannelId) {
        try {
          const vouchesChannel = await interaction.guild.channels.fetch(vouchesChannelId);
          if (vouchesChannel) {
            targetChannel = vouchesChannel;
          }
        } catch (channelError) {
          console.error('[VOUCHES-RESTORE] Error fetching vouches channel:', channelError);
        }
      }

      // Enviar mensaje inicial de confirmación
      await interaction.editReply({
        content: `🔄 Restaurando **${vouchesCount}** vouches... Esto puede tomar unos momentos.`
      });

      // Enviar cada vouch uno por uno con el mismo formato que cuando se crea un vouch
      const vouches = backupData.vouches || [];
      let sentCount = 0;
      
      for (const vouch of vouches) {
        try {
          // Crear embed del vouch (mismo formato que cuando se crea)
          const shopUrl = config.SHOP_URL || 'https://sellauth.com';
          const stars = vouch.stars || vouch.rating || 5;
          const message = vouch.message || vouch.product || 'Vouch restaurado';
          
          const vouchEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('✨ New Vouch Created!')
            .setURL(shopUrl)
            .addFields(
              {
                name: '💬 Vouch',
                value: message,
                inline: false
              },
              {
                name: '⭐ Rating',
                value: '⭐'.repeat(stars) + '☆'.repeat(5 - stars),
                inline: false
              },
              {
                name: '📋 Vouch N°',
                value: `#${vouch.id}`,
                inline: true
              },
              {
                name: '👤 Vouched by',
                value: vouch.vouchedBy ? `<@${vouch.vouchedBy}>` : (vouch.vouchedByUsername || 'Unknown'),
                inline: true
              },
              {
                name: '🕐 Vouched at',
                value: vouch.vouchedAt ? `<t:${Math.floor(new Date(vouch.vouchedAt).getTime() / 1000)}:F>` : '<t:0:F>',
                inline: true
              }
            )
            .setFooter({ 
              text: `Powered by itz_Secret_alt • Vouch #${vouch.id}`,
              iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp(vouch.vouchedAt ? new Date(vouch.vouchedAt) : new Date());

          // Si hay thumbnail del usuario original, intentar usarlo
          if (vouch.vouchedBy) {
            try {
              const user = await interaction.client.users.fetch(vouch.vouchedBy).catch(() => null);
              if (user) {
                vouchEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
              }
            } catch (e) {
              // Usar avatar del bot si no se puede obtener el del usuario
              vouchEmbed.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }));
            }
          } else {
            vouchEmbed.setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }));
          }

          // Preparar mensaje con o sin proof
          const messageOptions = { embeds: [vouchEmbed] };
          
          // Si hay proof, intentar agregarlo (aunque puede que la URL ya no sea válida)
          if (vouch.proof) {
            try {
              // Intentar agregar la imagen como attachment si es posible
              // Nota: Las URLs antiguas pueden no funcionar, pero intentamos
              messageOptions.files = [{ attachment: vouch.proof, name: 'proof.png' }];
            } catch (proofError) {
              // Si falla, simplemente no agregamos el proof
              console.warn(`[VOUCHES-RESTORE] No se pudo agregar proof para vouch #${vouch.id}`);
            }
          }

          // Enviar el vouch
          await targetChannel.send(messageOptions);
          sentCount++;

          // Pequeña pausa para evitar rate limits
          if (sentCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (vouchError) {
          console.error(`[VOUCHES-RESTORE] Error enviando vouch #${vouch.id}:`, vouchError);
          // Continuar con el siguiente vouch
        }
      }

      // Enviar mensaje separado de confirmación
      const restoreCompleteEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Los vouchers han sido restaurados.')
        .setDescription(`Se restauraron **${sentCount}** de **${vouchesCount}** vouches desde el backup.`)
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
          },
          {
            name: '📬 Canal',
            value: targetChannel.id === interaction.channel.id ? 'Canal actual' : `<#${targetChannel.id}>`,
            inline: false
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
          text: `Powered by itz_Secret_alt • Restored by ${interaction.user.username}`,
          iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      await targetChannel.send({ embeds: [restoreCompleteEmbed] });

      // Actualizar el mensaje de interacción
      await interaction.editReply({
        content: `✅ Restauración completada. Se enviaron **${sentCount}** vouches${targetChannel.id !== interaction.channel.id ? ` al canal <#${targetChannel.id}>` : ''}.`
      });

      console.log(`[VOUCHES-RESTORE] ✅ Vouches restored from ${backupFileName} (${sentCount}/${vouchesCount} vouches sent) by ${interaction.user.tag} (${interaction.user.id})`);

    } catch (error) {
      console.error('[VOUCHES-RESTORE] Error:', error);
      await interaction.editReply({
        content: `❌ Error restoring vouches: ${error.message}`
      }).catch(() => {});
    }
  }
};

