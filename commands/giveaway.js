import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { GuildConfig } from '../utils/GuildConfig.js';
import { config } from '../utils/config.js';

const GIVEAWAYS_FILE = './giveaways.json';

function loadGiveaways() {
  try {
    if (existsSync(GIVEAWAYS_FILE)) {
      const data = readFileSync(GIVEAWAYS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[GIVEAWAY] Error loading giveaways:', error);
  }
  return { giveaways: {}, nextId: 1 };
}

function saveGiveaways(data) {
  try {
    writeFileSync(GIVEAWAYS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[GIVEAWAY] Error saving giveaways:', error);
  }
}

function parseTime(timeString) {
  const timeStringLower = timeString.toLowerCase().trim();
  
  // Parse formats: 20min, 1d, 1w, 1h, 30s, etc.
  const timeRegex = /^(\d+)(min|m|h|d|w|s|sec|second|seconds|minute|minutes|hour|hours|day|days|week|weeks)$/;
  const match = timeStringLower.match(timeRegex);
  
  if (!match) {
    throw new Error('Invalid time format. Use: 20min, 1h, 1d, 1w, etc.');
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = {
    's': 1000,
    'sec': 1000,
    'second': 1000,
    'seconds': 1000,
    'm': 60 * 1000,
    'min': 60 * 1000,
    'minute': 60 * 1000,
    'minutes': 60 * 1000,
    'h': 60 * 60 * 1000,
    'hour': 60 * 60 * 1000,
    'hours': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'day': 24 * 60 * 60 * 1000,
    'days': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000,
    'week': 7 * 24 * 60 * 60 * 1000,
    'weeks': 7 * 24 * 60 * 60 * 1000
  };
  
  const multiplier = multipliers[unit];
  if (!multiplier) {
    throw new Error('Invalid time unit');
  }
  
  return value * multiplier;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  
  if (weeks > 0) return `${weeks}w ${days % 7}d`;
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new giveaway')
        .addStringOption((option) =>
          option
            .setName('prize')
            .setDescription('Prize for the giveaway')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addStringOption((option) =>
          option
            .setName('duration')
            .setDescription('Duration (e.g., 20min, 1h, 1d, 1w, or custom like 2h30min)')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('winners')
            .setDescription('Number of winners')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to host the giveaway (default: current channel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll winners for a giveaway')
        .addStringOption((option) =>
          option
            .setName('message_id')
            .setDescription('Message ID of the giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List active giveaways')
    ),

  onlyWhitelisted: true,
  requiredRole: 'admin',

  async execute(interaction, api) {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'create') {
      await this.createGiveaway(interaction);
    } else if (subcommand === 'end') {
      await this.endGiveaway(interaction);
    } else if (subcommand === 'reroll') {
      await this.rerollGiveaway(interaction);
    } else if (subcommand === 'list') {
      await this.listGiveaways(interaction);
    }
  },

  async createGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') || 1;
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      // Parse duration
      let durationMs;
      try {
        // Try to parse custom format like "2h30min" or "1d2h"
        const customRegex = /(\d+)([a-z]+)/gi;
        const matches = [...durationStr.matchAll(customRegex)];
        
        if (matches.length > 1) {
          // Custom format with multiple parts
          durationMs = matches.reduce((total, match) => {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            const multipliers = {
              's': 1000, 'sec': 1000, 'second': 1000, 'seconds': 1000,
              'm': 60 * 1000, 'min': 60 * 1000, 'minute': 60 * 1000, 'minutes': 60 * 1000,
              'h': 60 * 60 * 1000, 'hour': 60 * 60 * 1000, 'hours': 60 * 60 * 1000,
              'd': 24 * 60 * 60 * 1000, 'day': 24 * 60 * 60 * 1000, 'days': 24 * 60 * 60 * 1000,
              'w': 7 * 24 * 60 * 60 * 1000, 'week': 7 * 24 * 60 * 60 * 1000, 'weeks': 7 * 24 * 60 * 60 * 1000
            };
            return total + (value * (multipliers[unit] || 0));
          }, 0);
        } else {
          // Simple format
          durationMs = parseTime(durationStr);
        }
      } catch (error) {
        await interaction.editReply({
          content: `❌ Invalid duration format: ${error.message}\n\n**Examples:**\n• \`20min\` - 20 minutes\n• \`1h\` - 1 hour\n• \`1d\` - 1 day\n• \`1w\` - 1 week\n• \`2h30min\` - 2 hours 30 minutes\n• \`1d2h\` - 1 day 2 hours`
        });
        return;
      }

      if (durationMs < 10000) {
        await interaction.editReply({
          content: '❌ Duration must be at least 10 seconds'
        });
        return;
      }

      const endTime = Date.now() + durationMs;
      const giveawaysData = loadGiveaways();
      const giveawayId = `GW-${String(giveawaysData.nextId).padStart(4, '0')}`;
      giveawaysData.nextId++;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎉 GIVEAWAY')
        .setDescription(`**${prize}**`)
        .addFields(
          {
            name: '⏰ Ends',
            value: `<t:${Math.floor(endTime / 1000)}:R>`,
            inline: true
          },
          {
            name: '🎁 Winners',
            value: `${winners} winner(s)`,
            inline: true
          },
          {
            name: '👤 Hosted by',
            value: `${interaction.user}`,
            inline: true
          }
        )
        .setFooter({ text: `Giveaway ID: ${giveawayId} • React with 🎉 to enter!` })
        .setTimestamp(new Date(endTime));

      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${giveawayId}`)
          .setLabel('Join Giveaway')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Success)
      );

      const message = await targetChannel.send({
        embeds: [embed],
        components: [button]
      });

      // Save giveaway
      giveawaysData.giveaways[giveawayId] = {
        id: giveawayId,
        prize: prize,
        winners: winners,
        endTime: endTime,
        hostId: interaction.user.id,
        hostTag: interaction.user.tag,
        channelId: targetChannel.id,
        messageId: message.id,
        participants: [],
        ended: false,
        createdAt: new Date().toISOString()
      };
      saveGiveaways(giveawaysData);

      // Schedule end
      setTimeout(async () => {
        await this.endGiveawayAutomatically(giveawayId, interaction.client);
      }, durationMs);

      await interaction.editReply({
        content: `✅ Giveaway created in ${targetChannel}!\n\n**Giveaway ID:** ${giveawayId}\n**Prize:** ${prize}\n**Duration:** ${formatTime(durationMs)}\n**Winners:** ${winners}`
      });

      console.log(`[GIVEAWAY] ✅ Giveaway ${giveawayId} created by ${interaction.user.tag}`);

    } catch (error) {
      console.error('[GIVEAWAY] Error creating giveaway:', error);
      await interaction.editReply({
        content: `❌ Error creating giveaway: ${error.message}`
      }).catch(() => {});
    }
  },

  async endGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const messageId = interaction.options.getString('message_id');
      const giveawaysData = loadGiveaways();
      
      const giveaway = Object.values(giveawaysData.giveaways).find(
        g => g.messageId === messageId && !g.ended
      );

      if (!giveaway) {
        await interaction.editReply({
          content: '❌ Giveaway not found or already ended'
        });
        return;
      }

      await this.endGiveawayAutomatically(giveaway.id, interaction.client);

      await interaction.editReply({
        content: `✅ Giveaway ${giveaway.id} ended successfully`
      });

    } catch (error) {
      console.error('[GIVEAWAY] Error ending giveaway:', error);
      await interaction.editReply({
        content: `❌ Error ending giveaway: ${error.message}`
      }).catch(() => {});
    }
  },

  async rerollGiveaway(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const messageId = interaction.options.getString('message_id');
      const giveawaysData = loadGiveaways();
      
      const giveaway = giveawaysData.giveaways[Object.keys(giveawaysData.giveaways).find(
        key => giveawaysData.giveaways[key].messageId === messageId
      )];

      if (!giveaway || !giveaway.ended) {
        await interaction.editReply({
          content: '❌ Giveaway not found or not ended yet'
        });
        return;
      }

      if (giveaway.participants.length === 0) {
        await interaction.editReply({
          content: '❌ No participants to reroll'
        });
        return;
      }

      // Select new winners
      const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
      const newWinners = shuffled.slice(0, giveaway.winners);

      const channel = await interaction.guild.channels.fetch(giveaway.channelId);
      if (channel) {
        const rerollEmbed = new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('🎲 Giveaway Rerolled!')
          .setDescription(`**Prize:** ${giveaway.prize}`)
          .addFields(
            {
              name: '🎉 New Winners',
              value: newWinners.map(id => `<@${id}>`).join('\n') || 'No winners',
              inline: false
            }
          )
          .setFooter({ text: `Rerolled by ${interaction.user.username}` })
          .setTimestamp();

        await channel.send({ embeds: [rerollEmbed] });
      }

      await interaction.editReply({
        content: `✅ Giveaway rerolled! New winners: ${newWinners.map(id => `<@${id}>`).join(', ')}`
      });

    } catch (error) {
      console.error('[GIVEAWAY] Error rerolling giveaway:', error);
      await interaction.editReply({
        content: `❌ Error rerolling giveaway: ${error.message}`
      }).catch(() => {});
    }
  },

  async listGiveaways(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const giveawaysData = loadGiveaways();
      const activeGiveaways = Object.values(giveawaysData.giveaways).filter(g => !g.ended);

      if (activeGiveaways.length === 0) {
        await interaction.editReply({
          content: '📋 No active giveaways'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎉 Active Giveaways')
        .setDescription(`There are **${activeGiveaways.length}** active giveaway(s)`)
        .addFields(
          activeGiveaways.map(g => ({
            name: `${g.id} - ${g.prize}`,
            value: `**Winners:** ${g.winners}\n**Participants:** ${g.participants.length}\n**Ends:** <t:${Math.floor(g.endTime / 1000)}:R>\n**Channel:** <#${g.channelId}>`,
            inline: true
          }))
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[GIVEAWAY] Error listing giveaways:', error);
      await interaction.editReply({
        content: `❌ Error listing giveaways: ${error.message}`
      }).catch(() => {});
    }
  },

  async endGiveawayAutomatically(giveawayId, client) {
    try {
      const giveawaysData = loadGiveaways();
      const giveaway = giveawaysData.giveaways[giveawayId];

      if (!giveaway || giveaway.ended) return;

      giveaway.ended = true;
      saveGiveaways(giveawaysData);

      const guild = client.guilds.cache.get(giveaway.channelId ? 
        (await client.channels.fetch(giveaway.channelId))?.guildId : null
      );
      
      if (!guild) return;

      const channel = await guild.channels.fetch(giveaway.channelId);
      if (!channel) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      // Select winners
      const participants = giveaway.participants;
      if (participants.length === 0) {
        const noWinnersEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('🎉 Giveaway Ended')
          .setDescription(`**${giveaway.prize}**`)
          .addFields({
            name: '❌ No Winners',
            value: 'No one entered this giveaway.',
            inline: false
          })
          .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
          .setTimestamp();

        await message.edit({
          embeds: [noWinnersEmbed],
          components: []
        });

        await channel.send({ embeds: [noWinnersEmbed] });
        return;
      }

      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, Math.min(giveaway.winners, participants.length));

      const winnersEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Giveaway Ended')
        .setDescription(`**${giveaway.prize}**`)
        .addFields(
          {
            name: '🎊 Winner(s)',
            value: winners.map(id => `<@${id}>`).join('\n'),
            inline: false
          },
          {
            name: '📊 Statistics',
            value: `**Participants:** ${participants.length}\n**Winners:** ${winners.length}`,
            inline: true
          }
        )
        .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
        .setTimestamp();

      await message.edit({
        embeds: [winnersEmbed],
        components: []
      });

      await channel.send({
        content: `🎉 **Congratulations** ${winners.map(id => `<@${id}>`).join(', ')}! You won: **${giveaway.prize}**`,
        embeds: [winnersEmbed]
      });

      console.log(`[GIVEAWAY] ✅ Giveaway ${giveawayId} ended. Winners: ${winners.join(', ')}`);

    } catch (error) {
      console.error('[GIVEAWAY] Error ending giveaway automatically:', error);
    }
  }
};

