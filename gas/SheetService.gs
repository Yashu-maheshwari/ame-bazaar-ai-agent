/**
 * AME Bazaar AI Agent - Google Sheets Execution Database & History Service
 * File: gas/SheetService.gs
 */

const SheetService = {
  HEADERS: [
    'Timestamp',
    'File ID',
    'File Name',
    'Platform',
    'Caption',
    'Status',
    'Post ID',
    'Post URL',
    'Error',
    'Execution ID'
  ],

  /**
   * Get or create the log sheet instance
   */
  getLogSheet: function(config) {
    let ss;
    if (config.spreadsheetId) {
      ss = SpreadsheetApp.openById(config.spreadsheetId);
    } else {
      // Find or create default spreadsheet named AME Bazaar AI Agent Execution Log
      const files = DriveApp.getFilesByName("AME Bazaar AI Agent Execution Log");
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      } else {
        ss = SpreadsheetApp.create("AME Bazaar AI Agent Execution Log");
        Config.setProperty('SPREADSHEET_ID', ss.getId());
      }
    }

    let sheet = ss.getSheetByName(config.logSheetName || 'SocialMediaLog');
    if (!sheet) {
      sheet = ss.insertSheet(config.logSheetName || 'SocialMediaLog');
    }

    // Initialize Header Row if empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(this.HEADERS);
      const headerRange = sheet.getRange(1, 1, 1, this.HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1f2937');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    return sheet;
  },

  /**
   * Check if a file ID has already been successfully posted on a specific platform
   */
  isProcessed: function(config, fileId, platform = null) {
    if (!fileId) return false;
    const sheet = this.getLogSheet(config);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    // Col 1: File ID, Col 3: Platform, Col 5: Status
    for (let i = 1; i < data.length; i++) {
      const rowFileId = String(data[i][1]).trim();
      const rowPlatform = String(data[i][3]).trim();
      const rowStatus = String(data[i][5]).trim();

      if (rowFileId === String(fileId).trim() && rowStatus === 'SUCCESS') {
        if (!platform || rowPlatform === platform || rowPlatform === 'ALL') {
          return true;
        }
      }
    }
    return false;
  },

  /**
   * Get previous success status map for a file (e.g. { Facebook: true, Instagram: false })
   */
  getFilePlatformHistory: function(config, fileId) {
    const history = { Facebook: false, Instagram: false };
    if (!fileId) return history;

    const sheet = this.getLogSheet(config);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return history;

    for (let i = 1; i < data.length; i++) {
      const rowFileId = String(data[i][1]).trim();
      const rowPlatform = String(data[i][3]).trim();
      const rowStatus = String(data[i][5]).trim();

      if (rowFileId === String(fileId).trim() && rowStatus === 'SUCCESS') {
        if (rowPlatform === 'Facebook' || rowPlatform === 'ALL') history.Facebook = true;
        if (rowPlatform === 'Instagram' || rowPlatform === 'ALL') history.Instagram = true;
      }
    }
    return history;
  },

  /**
   * Append an execution log entry to Google Sheets
   */
  logExecution: function(config, entry) {
    const sheet = this.getLogSheet(config);
    const timestamp = Utilities.formatDate(new Date(), config.timeZone || 'Asia/Kolkata', 'yyyy-MM-dd HH:mm:ss');
    
    const row = [
      timestamp,
      entry.fileId || '',
      entry.fileName || '',
      entry.platform || 'General',
      entry.caption || '',
      entry.status || 'UNKNOWN',
      entry.postId || '',
      entry.postUrl || '',
      entry.error || '',
      entry.executionId || ''
    ];

    sheet.appendRow(row);
  }
};
