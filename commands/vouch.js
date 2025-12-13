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
        .setName('message')
        .setDescription('Message about the vouch (required)')
        .setRequired(true)
        .setMaxLength(500)
    )
    .addIntegerOption((option) =>
      option
        .setName('stars')
        .setDescription('Rating (1-5 stars) (required)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(5)
    )
    .addAttachmentOption((option) =>
      option
        .setName('proof')
        .setDescription('Image/video as proof (optional)')
        .setRequired(false)
    ),

  onlyWhitelisted: false,

  async execute(interaction, api) {
    try {
      await interaction.deferReply({ ephemeral: false });

      const message = interaction.options.getString('message');
      const stars = interaction.options.getInteger('stars');
      const proof = interaction.options.getAttachment('proof');

      // Cargar vouches existentes
      const vouchesData = loadVouches();
      const vouchNumber = vouchesData.nextNumber;
      
      // Incrementar número para el próximo vouch
      vouchesData.nextNumber = vouchNumber + 1;

      // Validar que proof sea una imagen/video si se proporciona
      if (proof) {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4'];
        if (!allowedTypes.includes(proof.contentType)) {
          await interaction.editReply({
            content: '❌ Proof must be a png, jpg, jpeg, webp, gif or mp4 file.'
          });
          return;
        }
      }

      // Crear vouch
      const vouch = {
        id: vouchNumber,
        message: message,
        stars: stars,
        proof: proof ? proof.url : null,
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
        .setDescription(message)
        .addFields(
          {
            name: '⭐ Rating',
            value: '⭐'.repeat(stars) + '☆'.repeat(5 - stars),
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

      // Agregar imagen si existe
      if (proof) {
        vouchEmbed.setImage(proof.url);
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
          'Message': message,
          'Stars': stars.toString(),
          'Proof': proof ? 'Yes' : 'No'
        }
      });

      console.log(`[VOUCH] ✅ Vouch #${vouchNumber} created by ${interaction.user.tag}: ${message} (${stars} stars)`);

    } catch (error) {
      console.error('[VOUCH] Error:', error);
      await interaction.editReply({
        content: `❌ Error creating vouch: ${error.message}`
      }).catch(() => {});
    }
  }
};

