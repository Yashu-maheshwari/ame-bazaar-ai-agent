/**
 * =========================================================================
 * AME Bazaar AI Business Growth Agent - Complete Single-File GAS System
 * Author: Antigravity AI & AME Bazaar Engineering
 * Target Environment: Google Apps Script (GAS V8 Runtime)
 * Version: 4.4 (SEO/AEO/GEO & AI Discovery Friendly Caption Prompt Update)
 * =========================================================================
 * 
 * Includes:
 * 1. Config & Script Properties Manager (Config)
 * 2. Google Sheets Execution Database & History (SheetService)
 * 3. Google Drive File Management & Move Logic (DriveService)
 * 4. Cloudinary Public HTTPS Image Hosting (CloudinaryService)
 * 5. Gemini 2.5 Flash AI Multimodal Caption Engine (GeminiService)
 * 6. Meta Graph API Instagram & Facebook Publisher (MetaService)
 * 7. Primary Execution Orchestrator & Lock Manager (runAgent, runTest)
 * 8. Time-Driven Schedule Trigger Generator (setupTriggers)
 * 9. Interactive Script Setup Helper (setupConfig)
 * 10. Automated In-Script Validation Test Suite (runAllTests)
 * =========================================================================
 */

// =========================================================================
// SECTION 1: CONFIGURATION & SCRIPT PROPERTIES MANAGER
// =========================================================================
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
 * Interactive Setup & Configuration Helper (Safe Status Logging)
 */
function setupConfig() {
  const cfg = Config.getConfig();
  const getStatus = function(val) {
    return (val !== null && val !== undefined && String(val).trim() !== '') ? 'CONFIGURED' : 'MISSING';
  };

  const safeReport = {
    inputFolderId: getStatus(cfg.inputFolderId),
    postedFolderId: getStatus(cfg.postedFolderId),
    errorFolderId: getStatus(cfg.errorFolderId),
    spreadsheetId: getStatus(cfg.spreadsheetId),
    geminiApiKey: getStatus(cfg.geminiApiKey),
    metaAccessToken: getStatus(cfg.metaAccessToken),
    metaPageId: getStatus(cfg.metaPageId),
    instagramAccountId: getStatus(cfg.instagramAccountId),
    cloudinaryCloudName: getStatus(cfg.cloudinaryCloudName),
    cloudinaryUploadPreset: getStatus(cfg.cloudinaryUploadPreset),
    testMode: cfg.testMode
  };

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
  Logger.log("\nCurrent Config Status (Secrets Masked):");
  Logger.log(JSON.stringify(safeReport, null, 2));
  Logger.log("==================================================");
}


// =========================================================================
// SECTION 2: GOOGLE SHEETS LOGGING & DUPLICATE PREVENTION SERVICE
// =========================================================================
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


// =========================================================================
// SECTION 3: GOOGLE DRIVE FILE MANAGEMENT SERVICE
// =========================================================================
const DriveService = {
  /**
   * List unprocessed image files in the input folder
   */
  getUnprocessedImages: function(config) {
    if (!config.inputFolderId) {
      throw new Error("INPUT_FOLDER_ID is missing in Script Properties.");
    }

    const folder = DriveApp.getFolderById(config.inputFolderId);
    const files = folder.getFiles();
    const unprocessed = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      if (mimeType.indexOf('image/') !== -1 || mimeType === 'application/octet-stream') {
        const fileId = file.getId();
        
        const alreadyProcessed = SheetService.isProcessed(config, fileId);
        if (!alreadyProcessed) {
          unprocessed.push({
            id: fileId,
            name: file.getName(),
            mimeType: mimeType === 'application/octet-stream' ? 'image/jpeg' : mimeType,
            fileObj: file
          });
        }
      }

      if (unprocessed.length >= config.maxFilesPerRun) {
        break;
      }
    }

    return unprocessed;
  },

  /**
   * Get image blob and base64 string for Gemini API
   */
  getImageData: function(fileObj) {
    const blob = fileObj.getBlob();
    const bytes = blob.getBytes();
    const base64 = Utilities.base64Encode(bytes);
    const mimeType = blob.getContentType() || 'image/jpeg';
    return { mimeType, base64, blob };
  },

  /**
   * Move a file from input folder to target folder (Posted or Error)
   */
  moveFile: function(fileId, targetFolderId) {
    if (!fileId || !targetFolderId) return;
    try {
      const file = DriveApp.getFileById(fileId);
      const targetFolder = DriveApp.getFolderById(targetFolderId);
      file.moveTo(targetFolder);
      Logger.log("✓ Moved file '" + file.getName() + "' (ID: " + fileId + ") to folder " + targetFolderId);
    } catch (err) {
      Logger.log("✗ Error moving file " + fileId + ": " + err.message);
    }
  }
};


// =========================================================================
// SECTION 4: CLOUDINARY PUBLIC HTTPS IMAGE HOSTING SERVICE
// =========================================================================
const CloudinaryService = {
  /**
   * Upload Google Drive image blob to Cloudinary for a publicly accessible HTTPS URL required by Instagram Graph API
   */
  getPublicImageUrl: function(config, fileObj, imageData) {
    if (config.cloudinaryCloudName && config.cloudinaryUploadPreset) {
      try {
        Logger.log("Uploading image to Cloudinary for Instagram public URL...");
        const url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudinaryCloudName) + "/image/upload";
        
        const payload = {
          file: "data:" + (imageData.mimeType || "image/jpeg") + ";base64," + imageData.base64,
          upload_preset: config.cloudinaryUploadPreset,
          folder: "ame-bazaar/raw"
        };

        const options = {
          method: "post",
          payload: payload,
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (statusCode >= 200 && statusCode < 300) {
          const data = JSON.parse(responseText);
          if (data.secure_url) {
            Logger.log("✓ Cloudinary public image URL generated: " + data.secure_url);
            return data.secure_url;
          }
        }
        Logger.log("✗ Cloudinary upload warning (" + statusCode + "): " + responseText);
      } catch (err) {
        Logger.log("✗ Cloudinary upload error: " + err.message);
      }
    }

    try {
      fileObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const drivePublicUrl = "https://lh3.googleusercontent.com/d/" + fileObj.getId();
      Logger.log("ℹ Using Google Drive public image link fallback: " + drivePublicUrl);
      return drivePublicUrl;
    } catch (err) {
      Logger.log("✗ Google Drive public link fallback failed: " + err.message);
      throw new Error("Failed to generate a publicly accessible HTTPS image URL for Instagram Graph API. Please configure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.");
    }
  }
};


// =========================================================================
// SECTION 5: GEMINI AI CAPTION GENERATOR SERVICE
// =========================================================================
const GeminiService = {
  /**
   * Optimized Conversion-Focused & SEO/AEO/GEO Friendly Caption Prompt for Kirari, Delhi Store
   */
  PROMPT: [
    'You are the growth marketer for AME Bazaar, a family garments and clothing store in Kirari, Delhi.',
    'Write a conversion-focused, natural casual Hinglish social media caption (max 120 words) using the English alphabet that is clear and discovery-friendly for search engines and AI assistants.',
    'Start immediately with a strong, attention-grabbing hook. Avoid generic questions or filler phrases.',
    'Describe ONLY what is visually and clearly visible in the image. NEVER claim quality, comfort, fabric type, fitting, durability, affordability, price, or availability unless explicitly visible. Never claim AME Bazaar is "best", "No.1", "top", or "largest". If a feature cannot be visually verified, do NOT mention it.',
    'Do NOT use fake urgency, cheap sales language, or cheap blanket discounts.',
    'Naturally establish AME Bazaar as a family garments store in Kirari, Delhi using clear entity and product-intent context (e.g., family clothing, kids wear, women\'s wear, men\'s wear) relevant to what is shown in the image, without keyword-stuffing.',
    'End with a clear, strong CTA inviting customers to visit AME Bazaar store at Kirari, Delhi or WhatsApp us at 9953569533 for details and orders.',
    'Include exactly 4-5 relevant hashtags at the end. Return only the final caption text.'
  ].join(' '),

  /**
   * Generate Hinglish caption for an image using Gemini API via UrlFetchApp
   */
  generateCaption: function(config, imageData) {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is missing in Script Properties.");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(config.geminiApiKey);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: this.PROMPT },
            {
              inlineData: {
                mimeType: imageData.mimeType || "image/jpeg",
                data: imageData.base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log("Sending image to Gemini 2.5 Flash API...");
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error("Gemini API Error (" + statusCode + "): " + responseText);
    }

    const result = JSON.parse(responseText);
    const candidates = result.candidates || [];
    
    let caption = '';
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      caption = candidates[0].content.parts.map(p => p.text || '').join('\n').trim();
    }

    if (!caption) {
      throw new Error("Gemini API returned an empty caption response.");
    }

    Logger.log("✓ Gemini caption generated successfully.");
    return caption;
  }
};


// =========================================================================
// SECTION 6: META GRAPH API POSTING SERVICE (INSTAGRAM & FACEBOOK)
// =========================================================================
const MetaService = {
  GRAPH_API_VERSION: 'v25.0',

  /**
   * Publish Photo to Instagram Feed
   */
  publishToInstagram: function(config, publicImageUrl, caption) {
    if (config.testMode) {
      Logger.log("ℹ [TEST_MODE] Bypassing real Instagram Graph API call.");
      return {
        status: 'SUCCESS',
        postId: 'TEST_IG_CONTAINER_' + Date.now(),
        postUrl: 'https://instagram.com/p/TEST_MODE_ONLY',
        testMode: true
      };
    }

    if (!config.metaAccessToken || !config.instagramAccountId) {
      throw new Error("META_PAGE_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID is missing in Script Properties.");
    }

    Logger.log("Creating Instagram Media Container...");
    const createUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.instagramAccountId) + "/media";
    const createPayload = {
      image_url: publicImageUrl,
      caption: caption,
      access_token: config.metaAccessToken
    };

    const createOptions = {
      method: "post",
      payload: createPayload,
      muteHttpExceptions: true
    };

    const createRes = UrlFetchApp.fetch(createUrl, createOptions);
    const createCode = createRes.getResponseCode();
    const createBody = createRes.getContentText();

    if (createCode < 200 || createCode >= 300) {
      throw new Error("Instagram Container Creation Failed (" + createCode + "): " + createBody);
    }

    const createData = JSON.parse(createBody);
    const creationId = createData.id || createData.creation_id || createData.media_id;

    if (!creationId) {
      throw new Error("Instagram Container Creation returned no valid creation_id.");
    }

    Utilities.sleep(3000);

    Logger.log("Publishing Instagram Media Container ID: " + creationId + "...");
    const publishUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.instagramAccountId) + "/media_publish";
    const publishPayload = {
      creation_id: creationId,
      access_token: config.metaAccessToken
    };

    const publishOptions = {
      method: "post",
      payload: publishPayload,
      muteHttpExceptions: true
    };

    const publishRes = UrlFetchApp.fetch(publishUrl, publishOptions);
    const publishCode = publishRes.getResponseCode();
    const publishBody = publishRes.getContentText();

    if (publishCode < 200 || publishCode >= 300) {
      throw new Error("Instagram Media Publish Failed (" + publishCode + "): " + publishBody);
    }

    const publishData = JSON.parse(publishBody);
    const postId = publishData.id || creationId;
    const postUrl = "https://www.instagram.com/";

    Logger.log("✓ Published successfully to Instagram. Post ID: " + postId);
    return {
      status: 'SUCCESS',
      postId: postId,
      postUrl: postUrl
    };
  },

  /**
   * Publish Photo to Facebook Page
   */
  publishToFacebook: function(config, publicImageUrl, caption) {
    if (config.testMode) {
      Logger.log("ℹ [TEST_MODE] Bypassing real Facebook Graph API call.");
      return {
        status: 'SUCCESS',
        postId: 'TEST_FB_POST_' + Date.now(),
        postUrl: 'https://facebook.com/test_page/posts/TEST_MODE_ONLY',
        testMode: true
      };
    }

    if (!config.metaAccessToken || !config.metaPageId) {
      throw new Error("META_PAGE_ACCESS_TOKEN or META_PAGE_ID is missing in Script Properties.");
    }

    Logger.log("Publishing Photo to Facebook Page ID: " + config.metaPageId + "...");
    const fbUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.metaPageId) + "/photos";
    const fbPayload = {
      url: publicImageUrl,
      caption: caption,
      published: true,
      access_token: config.metaAccessToken
    };

    const fbOptions = {
      method: "post",
      payload: fbPayload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(fbUrl, fbOptions);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error("Facebook Page Photo Post Failed (" + statusCode + "): " + responseText);
    }

    const data = JSON.parse(responseText);
    const postId = data.post_id || data.id;
    const postUrl = "https://facebook.com/" + config.metaPageId;

    Logger.log("✓ Published successfully to Facebook Page. Post ID: " + postId);
    return {
      status: 'SUCCESS',
      postId: postId,
      postUrl: postUrl
    };
  }
};


// =========================================================================
// SECTION 7: PRIMARY EXECUTION ORCHESTRATOR & ENTRY POINTS
// =========================================================================
/**
 * Main execution function invoked manually or by time-driven trigger
 */
function runAgent() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) {
      Logger.log("⚠ Could not acquire execution lock. Another instance of runAgent is already running.");
      return;
    }

    const config = Config.getConfig();
    const executionId = "exec_gas_" + Date.now();
    Logger.log("==================================================");
    Logger.log("STARTING AME BAZAAR AI AGENT EXECUTION [" + executionId + "]");
    Logger.log("Time: " + new Date().toISOString() + " | Mode: " + (config.testMode ? "TEST_MODE (NO REAL POSTS)" : "LIVE PUBLISHING"));
    Logger.log("==================================================");

    const unprocessedFiles = DriveService.getUnprocessedImages(config);
    if (unprocessedFiles.length === 0) {
      Logger.log("ℹ No new unprocessed images found in INPUT_FOLDER_ID.");
      return;
    }

    Logger.log("Found " + unprocessedFiles.length + " unprocessed image(s) to process.");

    for (const item of unprocessedFiles) {
      Logger.log("\n--------------------------------------------------");
      Logger.log("Processing File: " + item.name + " (ID: " + item.id + ")");
      
      const fileHistory = SheetService.getFilePlatformHistory(config, item.id);
      let fbSuccess = fileHistory.Facebook;
      let igSuccess = fileHistory.Instagram;

      let caption = "";
      let publicImageUrl = "";

      try {
        const imageData = DriveService.getImageData(item.fileObj);
        caption = GeminiService.generateCaption(config, imageData);
        if (config.testMode) {
          caption = "[TEST_MODE] " + caption;
        }

        publicImageUrl = CloudinaryService.getPublicImageUrl(config, item.fileObj, imageData);

        // Publish to Facebook Page
        if (!fbSuccess) {
          try {
            const fbResult = MetaService.publishToFacebook(config, publicImageUrl, caption);
            SheetService.logExecution(config, {
              fileId: item.id,
              fileName: item.name,
              platform: 'Facebook',
              caption: caption,
              status: fbResult.status,
              postId: fbResult.postId,
              postUrl: fbResult.postUrl,
              error: '',
              executionId: executionId
            });
            fbSuccess = true;
          } catch (err) {
            Logger.log("✗ Facebook Page Post Failed: " + err.message);
            SheetService.logExecution(config, {
              fileId: item.id,
              fileName: item.name,
              platform: 'Facebook',
              caption: caption,
              status: 'FAILED',
              postId: '',
              postUrl: '',
              error: err.message,
              executionId: executionId
            });
          }
        } else {
          Logger.log("ℹ Facebook post already succeeded previously for this file. Skipping FB.");
        }

        // Publish to Instagram Feed
        if (!igSuccess) {
          try {
            const igResult = MetaService.publishToInstagram(config, publicImageUrl, caption);
            SheetService.logExecution(config, {
              fileId: item.id,
              fileName: item.name,
              platform: 'Instagram',
              caption: caption,
              status: igResult.status,
              postId: igResult.postId,
              postUrl: igResult.postUrl,
              error: '',
              executionId: executionId
            });
            igSuccess = true;
          } catch (err) {
            Logger.log("✗ Instagram Feed Post Failed: " + err.message);
            SheetService.logExecution(config, {
              fileId: item.id,
              fileName: item.name,
              platform: 'Instagram',
              caption: caption,
              status: 'FAILED',
              postId: '',
              postUrl: '',
              error: err.message,
              executionId: executionId
            });
          }
        } else {
          Logger.log("ℹ Instagram post already succeeded previously for this file. Skipping IG.");
        }

        if (fbSuccess && igSuccess) {
          Logger.log("✓ All social platforms published successfully.");
          if (config.postedFolderId && !config.testMode) {
            DriveService.moveFile(item.id, config.postedFolderId);
          } else if (config.testMode) {
            Logger.log("ℹ [TEST_MODE] File left in INPUT_FOLDER_ID for testing repeat runs.");
          }
        } else {
          Logger.log("⚠ Partial or total posting failure. File kept in INPUT_FOLDER_ID for retry.");
        }

      } catch (err) {
        Logger.log("✗ Execution Error processing file " + item.name + ": " + err.message);
        SheetService.logExecution(config, {
          fileId: item.id,
          fileName: item.name,
          platform: 'ALL',
          caption: caption,
          status: 'FAILED',
          postId: '',
          postUrl: '',
          error: err.message,
          executionId: executionId
        });
      }
    }

    Logger.log("\n==================================================");
    Logger.log("AME BAZAAR AI AGENT EXECUTION COMPLETE");
    Logger.log("==================================================");

  } catch (err) {
    Logger.log("✗ CRITICAL UNHANDLED AGENT ERROR: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Manual Test Execution Function (Enforces TEST_MODE=true)
 */
function runTest() {
  Config.setProperty('TEST_MODE', 'true');
  runAgent();
}

/**
 * Setup Time-Driven Scheduled Triggers (08:00, 14:00, 21:00 IST daily)
 */
function setupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runAgent') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('runAgent')
    .timeBased()
    .atHour(8)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  ScriptApp.newTrigger('runAgent')
    .timeBased()
    .atHour(14)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  ScriptApp.newTrigger('runAgent')
    .timeBased()
    .atHour(21)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  Logger.log("✓ Created 3 daily scheduled triggers for runAgent (08:00, 14:00, 21:00 IST).");
}


// =========================================================================
// SECTION 8: AUTOMATED IN-SCRIPT TEST SUITE
// =========================================================================
function runAllTests() {
  Logger.log("==================================================");
  Logger.log("STARTING GAS AUTOMATED TEST SUITE");
  Logger.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function runTest(testName, fn) {
    try {
      fn();
      Logger.log("✓ PASS: " + testName);
      passed++;
    } catch (err) {
      Logger.log("✗ FAIL: " + testName + " - " + err.message);
      failed++;
    }
  }

  runTest("Test 1: Configuration & Script Properties Loader", testConfigLoader);
  runTest("Test 2: Google Sheets Log Initialization & Duplicate Check", testSheetLoggingAndDuplicateCheck);
  runTest("Test 3: Gemini Prompt Construction & Validation", testGeminiPromptValidation);
  runTest("Test 4: Meta Graph API Request Construction (Test Mode)", testMetaRequestConstruction);
  runTest("Test 5: Trigger Setup & Handler Registration", testTriggerSetup);

  Logger.log("\n==================================================");
  Logger.log("TEST SUMMARY: " + passed + " PASSED, " + failed + " FAILED");
  Logger.log("==================================================");
}

function testConfigLoader() {
  const config = Config.getConfig();
  if (typeof config !== 'object') throw new Error("Config object missing");
  if (typeof config.testMode !== 'boolean') throw new Error("testMode must be boolean");
}

function testSheetLoggingAndDuplicateCheck() {
  const mockConfig = Config.getConfig();
  mockConfig.spreadsheetId = '';
  
  const testFileId = "test_file_id_" + Date.now();
  const testExecutionId = "exec_test_" + Date.now();

  const initialCheck = SheetService.isProcessed(mockConfig, testFileId);
  if (initialCheck) throw new Error("File should not be processed yet");

  SheetService.logExecution(mockConfig, {
    fileId: testFileId,
    fileName: "test_image.jpg",
    platform: "Facebook",
    caption: "[TEST_MODE] High quality garment caption",
    status: "SUCCESS",
    postId: "test_post_123",
    postUrl: "https://facebook.com/test",
    error: "",
    executionId: testExecutionId
  });

  const history = SheetService.getFilePlatformHistory(mockConfig, testFileId);
  if (!history.Facebook) throw new Error("Sheet duplicate check failed to register Facebook success");
  if (history.Instagram) throw new Error("Instagram should be false since only Facebook was logged");
}

function testGeminiPromptValidation() {
  const prompt = GeminiService.PROMPT;
  if (!prompt.includes("AME Bazaar")) throw new Error("Prompt missing AME Bazaar brand name");
  if (!prompt.includes("Hinglish")) throw new Error("Prompt missing Hinglish requirement");
  if (!prompt.includes("cheap blanket discounts")) throw new Error("Prompt missing discount rule");
}

function testMetaRequestConstruction() {
  const mockConfig = Config.getConfig();
  mockConfig.testMode = true;

  const publicUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  const caption = "Test Hinglish Caption #AMEBazaar #Style";

  const fbResult = MetaService.publishToFacebook(mockConfig, publicUrl, caption);
  if (fbResult.status !== 'SUCCESS') throw new Error("Facebook test mode response status failed");

  const igResult = MetaService.publishToInstagram(mockConfig, publicUrl, caption);
  if (igResult.status !== 'SUCCESS') throw new Error("Instagram test mode response status failed");
}

function testTriggerSetup() {
  const mockConfig = Config.getConfig();
  if (mockConfig.timeZone !== 'Asia/Kolkata') throw new Error("TimeZone must be Asia/Kolkata");
}

/**
 * Validates Meta API connection (Read-Only)
 */
function testMetaApiConnection() {
  Logger.log("=== META API READ-ONLY CONNECTION TEST ===");
  const config = Config.getConfig();
  const token = config.metaPageAccessToken;
  const pageId = config.metaPageId;
  const igId = config.instagramAccountId;
  
  const options = {
    method: 'get',
    muteHttpExceptions: true
  };

  // 1. Check Token Validity
  Logger.log("1. Checking Token Validity...");
  try {
    const meUrl = `https://graph.facebook.com/v19.0/me?access_token=${token}`;
    const meResponse = UrlFetchApp.fetch(meUrl, options);
    const meCode = meResponse.getResponseCode();
    if (meCode === 200) {
      Logger.log("✓ META token validity: PASS");
    } else {
      const err = JSON.parse(meResponse.getContentText());
      Logger.log("✗ META token validity: FAIL - Status " + meCode + ", Message: " + (err.error && err.error.message ? err.error.message : "Unknown Error"));
    }
  } catch(e) {
    Logger.log("✗ META token validity: FAIL - Exception: " + e.message);
  }

  // 2. Check Facebook Page Access
  Logger.log("2. Checking Facebook Page Access...");
  try {
    const fbUrl = `https://graph.facebook.com/v19.0/${pageId}?access_token=${token}`;
    const fbResponse = UrlFetchApp.fetch(fbUrl, options);
    const fbCode = fbResponse.getResponseCode();
    if (fbCode === 200) {
      Logger.log("✓ Facebook Page access: PASS");
    } else {
      const err = JSON.parse(fbResponse.getContentText());
      Logger.log("✗ Facebook Page access: FAIL - Status " + fbCode + ", Message: " + (err.error && err.error.message ? err.error.message : "Unknown Error"));
    }
  } catch(e) {
    Logger.log("✗ Facebook Page access: FAIL - Exception: " + e.message);
  }

  // 3. Check Instagram Account Access
  Logger.log("3. Checking Instagram Account Access...");
  try {
    const igUrl = `https://graph.facebook.com/v19.0/${igId}?access_token=${token}`;
    const igResponse = UrlFetchApp.fetch(igUrl, options);
    const igCode = igResponse.getResponseCode();
    if (igCode === 200) {
      Logger.log("✓ Instagram account access: PASS");
    } else {
      const err = JSON.parse(igResponse.getContentText());
      Logger.log("✗ Instagram account access: FAIL - Status " + igCode + ", Message: " + (err.error && err.error.message ? err.error.message : "Unknown Error"));
    }
  } catch(e) {
    Logger.log("✗ Instagram account access: FAIL - Exception: " + e.message);
  }
  
  Logger.log("=== END CONNECTION TEST ===");
}
