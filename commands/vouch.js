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
        .setName('product')
        .setDescription('Product or service name (e.g., Amazon, Netflix, etc.)')
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
    )
    .addStringOption((option) =>
      option
        .setName('comment')
        .setDescription('Optional comment about the vouch')
        .setRequired(false)
        .setMaxLength(500)
    ),

  onlyWhitelisted: false,

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const product = interaction.options.getString('product');
      const value = interaction.options.getString('value');
      const rating = interaction.options.getInteger('rating') || 5;
      const comment = interaction.options.getString('comment') || null;

      // Cargar vouches existentes
      const vouchesData = loadVouches();
      const vouchNumber = vouchesData.nextNumber;
      
      // Incrementar número para el próximo vouch
      vouchesData.nextNumber = vouchNumber + 1;

      // Crear vouch
      const vouch = {
        id: vouchNumber,
        product: product,
        value: value,
        rating: rating,
        comment: comment,
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
        .setDescription(`**Vouch:** ${product} ${value}`)
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
        );

      // Agregar comentario si existe
      if (comment) {
        vouchEmbed.addFields({
          name: '💬 Comment',
          value: comment,
          inline: false
        });
      }

      vouchEmbed
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
          'Product': product,
          'Value': value,
          'Rating': rating.toString(),
          'Comment': comment || 'None'
        }
      });

      console.log(`[VOUCH] ✅ Vouch #${vouchNumber} creado por ${interaction.user.tag}: ${product} ${value}`);

    } catch (error) {
      console.error('[VOUCH] Error:', error);
      await interaction.editReply({
        content: `❌ Error al crear el vouch: ${error.message}`
      }).catch(() => {});
    }
  }
};

