import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, existsSync } from 'fs';

const VOUCHES_FILE = './vouches.json';

function loadVouches() {
  try {
    if (existsSync(VOUCHES_FILE)) {
      const data = readFileSync(VOUCHES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[VOUCH-LIST] Error loading vouches:', error);
  }
  return { vouches: [], nextNumber: 1 };
}

export default {
  data: new SlashCommandBuilder()
    .setName('vouch-list')
    .setDescription('View recent vouches')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of vouches to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Filter vouches by user (optional)')
        .setRequired(false)
    ),

  onlyWhitelisted: false,

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const limit = interaction.options.getInteger('limit') || 10;
      const targetUser = interaction.options.getUser('user');

      const vouchesData = loadVouches();
      let vouches = vouchesData.vouches || [];

      // Filtrar por usuario si se especifica
      if (targetUser) {
        vouches = vouches.filter(v => v.vouchedBy === targetUser.id);
      }

      // Ordenar por fecha (más recientes primero)
      vouches.sort((a, b) => new Date(b.vouchedAt) - new Date(a.vouchedAt));

      // Limitar cantidad
      vouches = vouches.slice(0, limit);

      if (vouches.length === 0) {
        await interaction.editReply({
          content: targetUser 
            ? `❌ No se encontraron vouches de ${targetUser.tag}`
            : '❌ No hay vouches disponibles'
        });
        return;
      }

      // Crear embed con lista de vouches
      const listEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Recent Vouches')
        .setDescription(
          vouches.map(vouch => {
            const date = new Date(vouch.vouchedAt);
            const dateStr = date.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            return `**#${vouch.id}** - ${vouch.service} ${vouch.value} ${'⭐'.repeat(vouch.rating)} - <@${vouch.vouchedBy}> (${dateStr})`;
          }).join('\n')
        )
        .setFooter({ 
          text: `Showing ${vouches.length} of ${vouchesData.vouches.length} total vouches`,
          iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [listEmbed]
      });

    } catch (error) {
      console.error('[VOUCH-LIST] Error:', error);
      await interaction.editReply({
        content: `❌ Error al listar vouches: ${error.message}`
      }).catch(() => {});
    }
  }
};

