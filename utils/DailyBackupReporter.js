import { EmbedBuilder } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

const BACKUP_CHANNEL_ID = '1442913427575013426';
const BACKUP_DIR = './backups';

/**
 * DailyBackupReporter - Creates daily backups and reports to staff
 */
export class DailyBackupReporter {
  constructor(client) {
    this.client = client;
  }

  /**
   * Create backup of critical data
   */
  async createBackup() {
    try {
      // Ensure backup directory exists
      if (!existsSync(BACKUP_DIR)) {
        const fs = await import('fs');
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }

      const timestamp = new Date().toISOString();
      const backupName = `backup_${new Date().toISOString().split('T')[0]}`;
      const backupPath = join(BACKUP_DIR, `${backupName}.json`);

      const backupData = {
        timestamp: timestamp,
        data: {}
      };

      // Backup key files
      const filesToBackup = ['variantsData.json', 'replaceHistory.json', 'sessionState.json', 'vouches.json'];

      for (const file of filesToBackup) {
        try {
          if (existsSync(`./${file}`)) {
            backupData.data[file] = JSON.parse(readFileSync(`./${file}`, 'utf-8'));
          }
        } catch (e) {
          console.error(`[BACKUP] Error backing up ${file}:`, e.message);
        }
      }

      // Consolidate daily vouches backups
      await this.consolidateDailyVouchesBackups();

      writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      return {
        success: true,
        path: backupPath,
        timestamp: timestamp,
        filesBackedUp: Object.keys(backupData.data).length
      };
    } catch (error) {
      console.error('[BACKUP] Error creating backup:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send backup report to channel
   */
  async sendBackupReport() {
    try {
      const channel = this.client.channels.cache.get(BACKUP_CHANNEL_ID);
      if (!channel) {
        console.error('[BACKUP] Backup channel not found');
        return;
      }

      const backup = await this.createBackup();

      if (!backup.success) {
        const errorEmbed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('❌ Backup Failed')
          .setDescription(`Error: ${backup.error}`)
          .setTimestamp();

        await channel.send({ embeds: [errorEmbed] });
        return;
      }

      // Get vouches backup info
      const vouchesBackupDir = './vouches_backups';
      let vouchesBackupInfo = null;
      if (existsSync(vouchesBackupDir)) {
        const today = new Date().toISOString().split('T')[0];
        const consolidatedFile = `vouches_daily_${today}.json`;
        const consolidatedPath = join(vouchesBackupDir, consolidatedFile);
        
        if (existsSync(consolidatedPath)) {
          try {
            const consolidatedData = JSON.parse(readFileSync(consolidatedPath, 'utf-8'));
            vouchesBackupInfo = {
              totalVouches: consolidatedData.totalVouches || 0,
              date: consolidatedData.date || today,
              instantBackupsConsolidated: consolidatedData.instantBackupsConsolidated || 0
            };
          } catch (e) {
            console.error('[BACKUP] Error reading consolidated backup:', e.message);
          }
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Daily Backup Completed')
        .setDescription('Automatic daily backup has been created successfully')
        .addFields(
          {
            name: '📅 Backup Date',
            value: new Date(backup.timestamp).toUTCString(),
            inline: true
          },
          {
            name: '📦 Files Backed Up',
            value: `**${backup.filesBackedUp}** files`,
            inline: true
          }
        );

      // Add vouches backup info if available
      if (vouchesBackupInfo) {
        embed.addFields({
          name: '💬 Vouches Backup',
          value: `**Total Vouches:** ${vouchesBackupInfo.totalVouches}\n**Date:** ${vouchesBackupInfo.date}\n**Instant Backups Consolidated:** ${vouchesBackupInfo.instantBackupsConsolidated}`,
          inline: false
        });
      }

      embed.addFields(
        {
          name: '💾 Backup Location',
          value: `\`${backup.path}\``,
          inline: false
        },
        {
          name: '📋 Backed Up Files',
          value: '• variantsData.json\n• replaceHistory.json\n• sessionState.json\n• vouches.json (consolidated)',
          inline: false
        }
      )
        .setFooter({
          text: 'SellAuth Bot Backup System',
          iconURL: 'https://cdn.discordapp.com/app-icons/1009849347124862193/2a07cee6e1c97f4ac1cbc8c8ef0b2d1c.png'
        })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log('[BACKUP] ✅ Daily backup report sent');
    } catch (error) {
      console.error('[BACKUP] Error sending report:', error.message);
    }
  }

  /**
   * Consolidate all instant backups from today into one daily backup
   */
  async consolidateDailyVouchesBackups() {
    try {
      const vouchesBackupDir = './vouches_backups';
      
      if (!existsSync(vouchesBackupDir)) {
        const fs = await import('fs');
        fs.mkdirSync(vouchesBackupDir, { recursive: true });
        return;
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Read all instant backup files from today
      const allFiles = readdirSync(vouchesBackupDir);
      const instantBackupsToday = allFiles.filter(file => 
        file.startsWith('vouches_instant_') && 
        file.includes(todayStr) &&
        file.endsWith('.json')
      );

      if (instantBackupsToday.length === 0) {
        console.log(`[BACKUP] No instant backups found for today (${todayStr})`);
        return;
      }

      console.log(`[BACKUP] Found ${instantBackupsToday.length} instant backups for today`);

      // Read the latest vouches.json (current state with all vouches)
      let allVouches = { vouches: [], nextNumber: 1 };
      if (existsSync('./vouches.json')) {
        try {
          allVouches = JSON.parse(readFileSync('./vouches.json', 'utf-8'));
        } catch (e) {
          console.error('[BACKUP] Error reading vouches.json:', e.message);
        }
      }

      // Create consolidated daily backup
      const consolidatedBackup = {
        date: todayStr,
        consolidatedAt: new Date().toISOString(),
        totalVouches: allVouches.vouches?.length || 0,
        nextNumber: allVouches.nextNumber || 1,
        vouches: allVouches.vouches || [],
        instantBackupsConsolidated: instantBackupsToday.length,
        note: `Daily consolidated backup - ${instantBackupsToday.length} instant backups merged`
      };

      // Save consolidated backup
      const consolidatedFileName = `vouches_daily_${todayStr}.json`;
      const consolidatedPath = join(vouchesBackupDir, consolidatedFileName);
      writeFileSync(consolidatedPath, JSON.stringify(consolidatedBackup, null, 2), 'utf-8');
      
      console.log(`[BACKUP] ✅ Daily consolidated backup created: ${consolidatedFileName}`);
      console.log(`[BACKUP] 📊 Total vouches in consolidated backup: ${consolidatedBackup.totalVouches}`);
      console.log(`[BACKUP] 📦 Instant backups consolidated: ${instantBackupsToday.length}`);

      // Delete instant backups after consolidation (keep only the consolidated one)
      let deletedCount = 0;
      for (const instantFile of instantBackupsToday) {
        try {
          const instantPath = join(vouchesBackupDir, instantFile);
          unlinkSync(instantPath);
          deletedCount++;
        } catch (deleteError) {
          console.error(`[BACKUP] Error deleting instant backup ${instantFile}:`, deleteError.message);
        }
      }

      console.log(`[BACKUP] 🗑️ Deleted ${deletedCount} instant backup files after consolidation`);

    } catch (consolidateError) {
      console.error('[BACKUP] Error consolidating daily vouches backups:', consolidateError.message);
    }
  }

  /**
   * Schedule daily backups at 03:00 UTC
   */
  scheduleDailyBackups() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(3, 0, 0, 0);

    const timeUntilNext = tomorrow - now;

    console.log(
      `[BACKUP] ✅ Daily backups scheduled at 03:00 UTC (in ${Math.ceil(timeUntilNext / 1000 / 60)} minutes)`
    );

    // Schedule for first time
    setTimeout(
      () => {
        this.sendBackupReport();
        // Then schedule for every 24 hours
        setInterval(() => this.sendBackupReport(), 24 * 60 * 60 * 1000);
      },
      timeUntilNext
    );
  }
}

export const createDailyBackupReporter = (client) => new DailyBackupReporter(client);
