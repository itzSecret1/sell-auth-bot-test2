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

      // Note: Daily consolidation happens at 00:00 UTC via scheduleDailyBackups()
      // This creates a regular backup but doesn't consolidate instant backups here

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
   * Consolidate all instant backups from YESTERDAY into one daily backup
   * This is called at the start of a new day to consolidate the previous day's backups
   */
  async consolidateDailyVouchesBackups(previousDayDate = null) {
    try {
      const vouchesBackupDir = './vouches_backups';
      
      if (!existsSync(vouchesBackupDir)) {
        const fs = await import('fs');
        fs.mkdirSync(vouchesBackupDir, { recursive: true });
        return;
      }

      // Get yesterday's date (or use provided date) in YYYY-MM-DD format
      let yesterdayStr;
      if (previousDayDate) {
        yesterdayStr = previousDayDate;
      } else {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterdayStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      }
      
      // Read all instant backup files from yesterday
      const allFiles = readdirSync(vouchesBackupDir);
      const instantBackupsYesterday = allFiles.filter(file => 
        file.startsWith('vouches_instant_') && 
        file.includes(yesterdayStr) &&
        file.endsWith('.json')
      );

      if (instantBackupsYesterday.length === 0) {
        console.log(`[BACKUP] No instant backups found for ${yesterdayStr} to consolidate`);
        return;
      }

      console.log(`[BACKUP] Found ${instantBackupsYesterday.length} instant backups from ${yesterdayStr} to consolidate`);

      // Read all instant backups and merge them to get all vouches from yesterday
      const allVouchesFromBackups = new Map(); // Use Map to avoid duplicates by ID
      
      for (const instantFile of instantBackupsYesterday) {
        try {
          const instantPath = join(vouchesBackupDir, instantFile);
          const backupData = JSON.parse(readFileSync(instantPath, 'utf-8'));
          
          // Add all vouches from this backup (avoid duplicates by ID)
          if (backupData.vouches && Array.isArray(backupData.vouches)) {
            for (const vouch of backupData.vouches) {
              if (vouch.id) {
                allVouchesFromBackups.set(vouch.id, vouch);
              }
            }
          }
        } catch (readError) {
          console.error(`[BACKUP] Error reading instant backup ${instantFile}:`, readError.message);
        }
      }

      // Convert Map to Array and sort by ID
      const consolidatedVouches = Array.from(allVouchesFromBackups.values())
        .sort((a, b) => (a.id || 0) - (b.id || 0));

      // Get the highest nextNumber from all backups
      let maxNextNumber = 1;
      for (const instantFile of instantBackupsYesterday) {
        try {
          const instantPath = join(vouchesBackupDir, instantFile);
          const backupData = JSON.parse(readFileSync(instantPath, 'utf-8'));
          if (backupData.nextNumber && backupData.nextNumber > maxNextNumber) {
            maxNextNumber = backupData.nextNumber;
          }
        } catch (e) {
          // Ignore errors
        }
      }

      // Create consolidated daily backup with all vouches from yesterday
      const consolidatedBackup = {
        date: yesterdayStr,
        consolidatedAt: new Date().toISOString(),
        totalVouches: consolidatedVouches.length,
        nextNumber: maxNextNumber,
        vouches: consolidatedVouches,
        instantBackupsConsolidated: instantBackupsYesterday.length,
        note: `Daily consolidated backup from ${yesterdayStr} - ${instantBackupsYesterday.length} instant backups merged into one backup`
      };

      // Save consolidated backup
      const consolidatedFileName = `vouches_daily_${yesterdayStr}.json`;
      const consolidatedPath = join(vouchesBackupDir, consolidatedFileName);
      writeFileSync(consolidatedPath, JSON.stringify(consolidatedBackup, null, 2), 'utf-8');
      
      console.log(`[BACKUP] ✅ Daily consolidated backup created: ${consolidatedFileName}`);
      console.log(`[BACKUP] 📊 Total vouches in consolidated backup: ${consolidatedBackup.totalVouches}`);
      console.log(`[BACKUP] 📦 Instant backups consolidated: ${instantBackupsYesterday.length}`);

      // Delete instant backups after consolidation (keep only the consolidated one)
      let deletedCount = 0;
      for (const instantFile of instantBackupsYesterday) {
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
   * Schedule daily backups at 00:00 UTC (start of new day)
   * Consolidates yesterday's instant backups into one daily backup
   */
  scheduleDailyBackups() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0); // 00:00 UTC (start of new day)

    const timeUntilNext = tomorrow - now;

    console.log(
      `[BACKUP] ✅ Daily backups scheduled at 00:00 UTC (start of new day) - in ${Math.ceil(timeUntilNext / 1000 / 60)} minutes`
    );
    console.log(`[BACKUP] 📅 Will consolidate yesterday's instant backups when new day starts`);

    // Schedule for first time
    setTimeout(
      () => {
        // Consolidate yesterday's backups first
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        this.consolidateDailyVouchesBackups(yesterdayStr);
        
        // Then send backup report
        this.sendBackupReport();
        
        // Then schedule for every 24 hours at 00:00 UTC
        setInterval(() => {
          // Consolidate yesterday's backups
          const prevDay = new Date();
          prevDay.setUTCDate(prevDay.getUTCDate() - 1);
          const prevDayStr = prevDay.toISOString().split('T')[0];
          this.consolidateDailyVouchesBackups(prevDayStr);
          
          // Send backup report
          this.sendBackupReport();
        }, 24 * 60 * 60 * 1000);
      },
      timeUntilNext
    );
  }
}

export const createDailyBackupReporter = (client) => new DailyBackupReporter(client);
