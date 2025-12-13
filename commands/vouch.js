import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { AdvancedCommandLogger } from '../utils/advancedCommandLogger.js';

const VOUCHES_FILE = './vouches.json';

// Cargar vouches
function loadVouches() {
  try {
    if (existsSync(VOUCHES_FILE)) {
      const data = readFileSync(VOUCHES_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[VOUCH] Error loading vouches:', error);
  }
  return { vouches: [], nextNumber: 1 };
}

// Guardar vouches
function saveVouches(data) {
  try {
    writeFileSync(VOUCHES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[VOUCH] Error saving vouches:', error);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('vouch')
    .setDescription('Create a new vouch')
    .addStringOption((option) =>
      option
        .setName('service')
        .setDescription('Service or product name (e.g., Amazon, Netflix, etc.)')
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((option) =>
      option
        .setName('value')
        .setDescription('Value of the vouch (e.g., 1000$, $50, etc.)')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addIntegerOption((option) =>
      option
        .setName('rating')
        .setDescription('Rating (1-5 stars)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5)
    ),

  onlyWhitelisted: false,

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const service = interaction.options.getString('service');
      const value = interaction.options.getString('value');
      const rating = interaction.options.getInteger('rating') || 5;

      // Cargar vouches existentes
      const vouchesData = loadVouches();
      const vouchNumber = vouchesData.nextNumber;
      
      // Incrementar número para el próximo vouch
      vouchesData.nextNumber = vouchNumber + 1;

      // Crear vouch
      const vouch = {
        id: vouchNumber,
        service: service,
        value: value,
        rating: rating,
        vouchedBy: interaction.user.id,
        vouchedByUsername: interaction.user.username,
        vouchedByTag: interaction.user.tag,
        vouchedAt: new Date().toISOString(),
        guildId: interaction.guild.id,
        channelId: interaction.channel.id
      };

      // Guardar vouch
      vouchesData.vouches.push(vouch);
      saveVouches(vouchesData);

      // Crear embed del vouch
      const vouchEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✨ New Vouch Created!')
        .setDescription(`**Vouch:** ${service} ${value}`)
        .addFields(
          {
            name: '⭐ Rating',
            value: '⭐'.repeat(rating) + '☆'.repeat(5 - rating),
            inline: false
          },
          {
            name: '📋 Vouch N°',
            value: `#${vouchNumber}`,
            inline: true
          },
          {
            name: '👤 Vouched by',
            value: `<@${interaction.user.id}>`,
            inline: true
          },
          {
            name: '🕐 Vouched at',
            value: `<t:${Math.floor(new Date().getTime() / 1000)}:F>`,
            inline: true
          }
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
          text: `Powered by SellAuth Bot • Vouch #${vouchNumber}`,
          iconURL: interaction.client.user.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      await interaction.editReply({
        embeds: [vouchEmbed]
      });

      // Log
      await AdvancedCommandLogger.logCommand(interaction, 'vouch', {
        status: 'EXECUTED',
        result: 'Vouch created successfully',
        metadata: {
          'Vouch Number': vouchNumber.toString(),
          'Service': service,
          'Value': value,
          'Rating': rating.toString()
        }
      });

      console.log(`[VOUCH] ✅ Vouch #${vouchNumber} creado por ${interaction.user.tag}: ${service} ${value}`);

    } catch (error) {
      console.error('[VOUCH] Error:', error);
      await interaction.editReply({
        content: `❌ Error al crear el vouch: ${error.message}`
      }).catch(() => {});
    }
  }
};

