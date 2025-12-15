import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';
import { ErrorLog } from '../utils/errorLogger.js';
import { GuildConfig } from '../utils/GuildConfig.js';
import { config } from '../utils/config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server (Admin only)')
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('ID or tag of the user to unban')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for the unban (optional)')
        .setRequired(false)
        .setMaxLength(500)
    ),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userInput = interaction.options.getString('user');
      const reason = interaction.options.getString('reason') || 'No reason specified';

      // Verificar que el bot pueda banear (necesario para unban)
      const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
      if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({
          content: '❌ The bot does not have permission to unban members'
        });
        return;
      }

      // Verificar que el usuario que ejecuta el comando tenga permisos
      if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await interaction.editReply({
          content: '❌ You do not have permission to unban members'
        });
        return;
      }

      // Obtener lista de baneados
      let bannedUsers;
      try {
        bannedUsers = await interaction.guild.bans.fetch();
      } catch (fetchError) {
        await interaction.editReply({
          content: '❌ Error fetching the ban list'
        });
        return;
      }

      // Buscar el usuario baneado
      let targetBan = null;
      
      // Intentar buscar por ID
      if (userInput.match(/^\d+$/)) {
        targetBan = bannedUsers.get(userInput);
      }
      
      // Si no se encontró por ID, buscar por tag o username
      if (!targetBan) {
        const searchLower = userInput.toLowerCase();
        for (const [userId, ban] of bannedUsers) {
          const userTag = ban.user.tag.toLowerCase();
          const username = ban.user.username.toLowerCase();
          
          if (userTag.includes(searchLower) || 
              username.includes(searchLower) ||
              userId === userInput) {
            targetBan = ban;
            break;
          }
        }
      }

      if (!targetBan) {
        await interaction.editReply({
          content: `❌ User not found in the ban list: \`${userInput}\``
        });
        return;
      }

      // Desbanear
      try {
        await interaction.guild.members.unban(targetBan.user.id, `${reason} | Desbaneado por: ${interaction.user.tag}`);

        // Crear embed de confirmación
        const unbanEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ User Unbanned')
          .addFields(
            {
              name: '👤 User',
              value: `${targetBan.user} (${targetBan.user.tag})`,
              inline: true
            },
            {
              name: '🆔 ID',
              value: targetBan.user.id,
              inline: true
            },
            {
              name: '👮 Unbanned by',
              value: `${interaction.user} (${interaction.user.tag})`,
              inline: true
            },
            {
              name: '📝 Reason',
              value: reason,
              inline: false
            },
            {
              name: '📋 Original Ban Reason',
              value: targetBan.reason || 'No reason',
              inline: false
            }
          )
          .setTimestamp()
          .setFooter({ text: 'SellAuth Bot | Moderation' });

        await interaction.editReply({
          embeds: [unbanEmbed]
        });

        // Log
        await AdvancedCommandLogger.logCommand(interaction, 'unban', {
          status: 'EXECUTED',
          result: 'User unbanned successfully',
          metadata: {
            'Target User': targetBan.user.tag,
            'Target ID': targetBan.user.id,
            'Reason': reason
          }
        });

        console.log(`[UNBAN] ✅ Usuario ${targetBan.user.tag} (${targetBan.user.id}) desbaneado por ${interaction.user.tag}`);

      } catch (unbanError) {
        console.error('[UNBAN] Error al desbanear:', unbanError);
        
        let errorMsg = 'Unknown error while unbanning';
        if (unbanError.message.includes('Missing Permissions')) {
          errorMsg = 'The bot does not have permission to unban';
        } else {
          errorMsg = unbanError.message;
        }

        await interaction.editReply({
          content: `❌ Error unbanning user: ${errorMsg}`
        });

        ErrorLog.log('unban', unbanError, {
          targetUserId: targetBan.user.id,
          executorId: interaction.user.id,
          reason: reason
        });
      }

    } catch (error) {
      console.error('[UNBAN] Error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`
      }).catch(() => {});
    }
  }
};

