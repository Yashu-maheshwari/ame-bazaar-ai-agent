/**
 * AME Bazaar AI Agent - Configuration & Properties Manager
 * File: gas/Config.gs
 */

const Config = {
  /**
   * Get a script property value with optional fallback
   */
  getProperty: function(key, defaultValue = '') {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return (value !== null && value !== undefined && value !== '') ? value : defaultValue;
  },

  /**
   * Set a script property value
   */
  setProperty: function(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, String(value));
  },

  /**
   * Get all environment configuration parameters
   */
  getConfig: function() {
    return {
      // Google Drive Folder IDs
      inputFolderId: this.getProperty('INPUT_FOLDER_ID', ''),
      postedFolderId: this.getProperty('POSTED_FOLDER_ID', ''),
      errorFolderId: this.getProperty('ERROR_FOLDER_ID', ''),

      // Google Spreadsheet Log ID
      spreadsheetId: this.getProperty('SPREADSHEET_ID', ''),
      logSheetName: this.getProperty('LOG_SHEET_NAME', 'SocialMediaLog'),

      // AI & Social Media API Keys / Credentials
      geminiApiKey: this.getProperty('GEMINI_API_KEY', ''),
      metaAccessToken: this.getProperty('META_PAGE_ACCESS_TOKEN', this.getProperty('META_ACCESS_TOKEN', '')),
      metaPageId: this.getProperty('META_PAGE_ID', ''),
      instagramAccountId: this.getProperty('INSTAGRAM_ACCOUNT_ID', this.getProperty('IG_USER_ID', '')),

      // Cloudinary Public Hosting (for Instagram Graph API image URL requirement)
      cloudinaryCloudName: this.getProperty('CLOUDINARY_CLOUD_NAME', ''),
      cloudinaryUploadPreset: this.getProperty('CLOUDINARY_UPLOAD_PRESET', ''),

      // Execution & Safety Controls
      testMode: this.getProperty('TEST_MODE', 'true').toLowerCase() === 'true',
      maxFilesPerRun: parseInt(this.getProperty('MAX_FILES_PER_RUN', '1'), 10),
      timeZone: 'Asia/Kolkata'
    };
  }
};

/**
 * Setup & Configuration Helper
 * Run this function once in GAS Script Editor to view or set required Script Properties.
 */
function setupConfig() {
  const props = PropertiesService.getScriptProperties();
  Logger.log("==================================================");
  Logger.log("AME BAZAAR AI AGENT - SCRIPT PROPERTIES SETUP");
  Logger.log("==================================================");
  Logger.log("Required Script Properties to set in Project Settings > Script Properties:\n");
  Logger.log("1. INPUT_FOLDER_ID           : Google Drive Folder ID for incoming images");
  Logger.log("2. POSTED_FOLDER_ID          : Google Drive Folder ID for successfully posted images");
  Logger.log("3. ERROR_FOLDER_ID           : Google Drive Folder ID for failed images");
  Logger.log("4. SPREADSHEET_ID            : Google Sheet ID for SocialMediaLog execution history");
  Logger.log("5. GEMINI_API_KEY            : Google Gemini API Key");
  Logger.log("6. META_PAGE_ACCESS_TOKEN    : Meta Graph API Page Access Token");
  Logger.log("7. META_PAGE_ID              : Facebook Page ID");
  Logger.log("8. INSTAGRAM_ACCOUNT_ID      : Instagram Business Account ID");
  Logger.log("9. CLOUDINARY_CLOUD_NAME     : Cloudinary Cloud Name (for Instagram Public Image URL)");
  Logger.log("10. CLOUDINARY_UPLOAD_PRESET : Cloudinary Unsigned Upload Preset");
  Logger.log("11. TEST_MODE                : 'true' (safety mode, no real posts) or 'false' (live publishing)");
  Logger.log("\nCurrent Config State:");
  Logger.log(JSON.stringify(Config.getConfig(), null, 2));
  Logger.log("==================================================");
}
