import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { TicketManager } from '../utils/TicketManager.js';
import { GuildConfig } from '../utils/GuildConfig.js';
import { config } from '../utils/config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rename')
    .setDescription('Renombrar un ticket')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Nuevo nombre para el ticket')
        .setRequired(true)
        .setMaxLength(100)
    ),

  onlyWhitelisted: true,
  requiredRole: 'staff',

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const newName = interaction.options.getString('name');
      const channel = interaction.channel;

      // Verificar que estamos en un canal de ticket
      const ticket = TicketManager.getTicketByChannel(channel.id);
      if (!ticket) {
        await interaction.editReply({
          content: '❌ Este comando solo puede usarse en un canal de ticket.'
        });
        return;
      }

      // Renombrar el canal
      try {
        await channel.setName(newName.toLowerCase().replace(/\s+/g, '-'));
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('✅ Ticket Renombrado')
          .setDescription(`El ticket ha sido renombrado a: **${newName}**`)
          .setFooter({ text: `Renombrado por ${interaction.user.username}` })
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed]
        });

        console.log(`[RENAME] Ticket ${ticket.id} renombrado a "${newName}" por ${interaction.user.tag}`);
      } catch (error) {
        console.error('[RENAME] Error:', error);
        await interaction.editReply({
          content: `❌ Error al renombrar el ticket: ${error.message}`
        });
      }

    } catch (error) {
      console.error('[RENAME] Error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`
      }).catch(() => {});
    }
  }
};

