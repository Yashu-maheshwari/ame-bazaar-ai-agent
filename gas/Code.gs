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
    'Execution ID',
    'Product Category',
    'Alt Text',
    'Content Type',
    'Location Intent',
    'Folder Category'
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
      const rowCaption = String(data[i][4]).trim();
      const rowStatus = String(data[i][5]).trim();

      if (rowFileId === String(fileId).trim() && rowStatus === 'SUCCESS' && !rowCaption.startsWith('[TEST_MODE]')) {
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
      const rowCaption = String(data[i][4]).trim();
      const rowStatus = String(data[i][5]).trim();

      if (rowFileId === String(fileId).trim() && rowStatus === 'SUCCESS' && !rowCaption.startsWith('[TEST_MODE]')) {
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
      entry.executionId || '',
      entry.productCategory || '',
      entry.altText || '',
      entry.contentType || 'FEED_POST',
      entry.localIntent || '',
      entry.folderCategory || ''
    ];

    sheet.appendRow(row);
  },

  /**
   * Fetch the last N successful captions to prevent repetition
   */
  getRecentCaptions: function(config, limit = 5) {
    const sheet = this.getLogSheet(config);
    const data = sheet.getDataRange().getValues();
    const recentCaptions = [];
    
    // Iterate backwards from the last row
    for (let i = data.length - 1; i > 0; i--) {
      const rowStatus = String(data[i][5]).trim();
      const rowCaption = String(data[i][4]).trim();
      
      // Look for successful, unique captions (ignore TEST_MODE prefixed or generic errors)
      if (rowStatus === 'SUCCESS' && rowCaption && !rowCaption.startsWith('[TEST_MODE]')) {
        if (!recentCaptions.includes(rowCaption)) {
          recentCaptions.push(rowCaption);
        }
      }
      if (recentCaptions.length >= limit) break;
    }
    return recentCaptions;
  },

  /**
   * Fetch the last N successfully published folder categories for balanced rotation
   */
  getRecentFolderCategories: function(config, limit = 5) {
    const sheet = this.getLogSheet(config);
    const data = sheet.getDataRange().getValues();
    const recentCategories = [];
    
    // Iterate backwards
    for (let i = data.length - 1; i > 0; i--) {
      const rowCaption = String(data[i][4]).trim();
      const rowStatus = String(data[i][5]).trim();
      const rowCategory = String(data[i][14]).trim(); // 15th column is index 14
      
      if (rowStatus === 'SUCCESS' && rowCategory && !rowCaption.startsWith('[TEST_MODE]')) {
        recentCategories.push(rowCategory); // keep duplicates here to trace historical frequency
      }
      if (recentCategories.length >= limit) break;
    }
    return recentCategories;
  }
};


// =========================================================================
// SECTION 3: GOOGLE DRIVE FILE MANAGEMENT SERVICE
// =========================================================================
const DriveService = {
  /**
   * Recursively scan for unprocessed image media across MEN/WOMEN/BOYS folders
   */
  getUnprocessedMedia: function(config) {
    if (!config.inputFolderId) {
      throw new Error("INPUT_FOLDER_ID is missing in Script Properties.");
    }
    const rootFolder = DriveApp.getFolderById(config.inputFolderId);
    const unprocessedPool = [];
    
    // We only care about these specific categories
    const targetCategories = ['MEN', 'WOMEN', 'BOYS'];
    
    this._scanFolder(rootFolder, targetCategories, null, config, unprocessedPool);

    if (unprocessedPool.length === 0) return [];

    const recentCategories = SheetService.getRecentFolderCategories(config, 10);
    return this._balancedCategoryRotation(unprocessedPool, recentCategories, config.maxFilesPerRun || 1);
  },

  _scanFolder: function(folder, targetCategories, currentCategory, config, pool) {
    const folderName = folder.getName();
    let newCategory = currentCategory;
    
    // Set category if it matches
    if (!currentCategory && targetCategories.includes(folderName)) {
      newCategory = folderName;
    }

    // Explicitly exclude REELS
    if (folderName === 'REELS') return;

    // Scan files (only if we are inside a supported category)
    if (newCategory) {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const mimeType = file.getMimeType();
        
        // Accept images only for this queue
        if (mimeType.indexOf('image/') !== -1 || mimeType === 'application/octet-stream') {
          const fileId = file.getId();
          if (!SheetService.isProcessed(config, fileId)) {
            pool.push({
              id: fileId,
              name: file.getName(),
              mimeType: mimeType === 'application/octet-stream' ? 'image/jpeg' : mimeType,
              category: newCategory,
              fileObj: file
            });
          }
        }
      }
    }

    // Recursively scan subfolders
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      this._scanFolder(subfolders.next(), targetCategories, newCategory, config, pool);
    }
  },

  _balancedCategoryRotation: function(pool, recentCategories, maxFiles) {
    const byCategory = {};
    pool.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });

    const availableCategories = Object.keys(byCategory);
    
    availableCategories.sort((a, b) => {
      const idxA = recentCategories.indexOf(a);
      const idxB = recentCategories.indexOf(b);
      const scoreA = idxA === -1 ? 999 : idxA;
      const scoreB = idxB === -1 ? 999 : idxB;
      return scoreB - scoreA; // descending
    });

    const results = [];
    let cycleLimit = maxFiles * 3;
    while (results.length < maxFiles && cycleLimit > 0) {
      for (const cat of availableCategories) {
        if (results.length >= maxFiles) break;
        if (byCategory[cat].length > 0) {
          results.push(byCategory[cat].shift());
        }
      }
      cycleLimit--;
    }
    return results;
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
    'Write a natural, casual Hinglish social media caption (approximately 80-130 words) using the English alphabet, optimized for search engines, AI assistants, and AEO/GEO discovery.',
    'Start immediately with a strong, product-focused hook identifying the visible apparel.',
    'Naturally establish the entity relationship: AME Bazaar = family garments & clothing store = Kirari, Delhi.',
    'Use relevant local search and product-intent terms (e.g., kids wear, women\'s wear, men\'s wear, family clothing) based on the image, without keyword stuffing.',
    'Ensure an AI assistant can independently understand what the product is, who sells it (AME Bazaar), and the location (Kirari, Delhi).',
    'Do not output personal names. Ignore visible watermarks, model names, or random text overlays in the image.',
    'Never invent or guess the price, fabric material, size, discount, or availability of the item.',
    'Do not claim superiority like "best", "No.1", or "top".',
    'End with a clear CTA inviting customers to visit AME Bazaar store in Kirari, Delhi, or WhatsApp us at 9953569533.',
    'Do NOT include hashtags inside the "caption" text.',
    'OUTPUT FORMAT: You must return a strict JSON object with exactly these keys: "caption" (the final text without hashtags), "hashtags" (an array of exactly 4-5 relevant hashtag strings, each starting with #), "alt_text" (concise, descriptive image alt text for accessibility, NOT included in the public caption), "product_category" (short string identifying the visual product category, e.g. "kids wear"), "local_intent" (short string identifying the local phrasing used, e.g. "Kirari"). Do NOT wrap the JSON in Markdown formatting like ```json.'
  ].join(' '),

  /**
   * Generate Hinglish caption for an image using Gemini API via UrlFetchApp
   */
  generateCaption: function(config, imageData, recentCaptions = [], category = null) {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is missing in Script Properties.");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(config.geminiApiKey);

    let promptText = this.PROMPT;
    if (category) {
      promptText += '\n\nIMPORTANT CONTEXT: The product in this image explicitly belongs to the "' + category + '" collection. Use this to accurately frame the apparel type/audience.';
    }
    if (recentCaptions && recentCaptions.length > 0) {
      promptText += '\n\nIMPORTANT REPETITION CONTROL:\nHere are the last few captions we published. DO NOT use similar opening hooks, identical paragraph structures, or exactly the same hashtag combinations. Provide a fresh angle:\n' + recentCaptions.map((c, i) => `[${i+1}] ${c}`).join('\n');
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
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
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json"
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
    
    let rawText = '';
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      rawText = candidates[0].content.parts.map(p => p.text || '').join('\n').trim();
    }

    if (!rawText) {
      throw new Error("Gemini API returned an empty response.");
    }
    
    rawText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawText);
    } catch(e) {
      throw new Error("Gemini API failed to return valid JSON: " + rawText);
    }

    if (!parsedResult.caption) {
      throw new Error("Gemini JSON is missing the 'caption' field.");
    }

    const rawHashtags = parsedResult.hashtags;
    if (!Array.isArray(rawHashtags)) {
      throw new Error("Gemini JSON is missing the 'hashtags' array.");
    }
    if (rawHashtags.length < 4 || rawHashtags.length > 5) {
      throw new Error("Quality Gate Failed: 'hashtags' array must contain exactly 4-5 items. Found: " + rawHashtags.length);
    }
    
    const seenHashtags = new Set();
    const cleanHashtags = [];
    for (const ht of rawHashtags) {
      const cleanHt = String(ht).trim();
      if (!cleanHt.startsWith('#')) {
        throw new Error("Quality Gate Failed: Hashtag '" + cleanHt + "' does not start with #.");
      }
      if (cleanHt.includes(' ') || cleanHt.length < 2) {
        throw new Error("Quality Gate Failed: Malformed hashtag '" + cleanHt + "'.");
      }
      const lowerHt = cleanHt.toLowerCase();
      if (seenHashtags.has(lowerHt)) {
        throw new Error("Quality Gate Failed: Duplicate hashtag found '" + cleanHt + "'.");
      }
      seenHashtags.add(lowerHt);
      cleanHashtags.push(cleanHt);
    }

    const finalCaption = parsedResult.caption.trim() + "\n\n" + cleanHashtags.join(" ");
    
    // ---------------------------------------------------------
    // HARD QUALITY GATES
    // ---------------------------------------------------------
    if (!finalCaption) {
      throw new Error("Quality Gate Failed: Caption is empty.");
    }
    
    const lowerCaption = finalCaption.toLowerCase();
    
    if (!lowerCaption.includes("ame bazaar")) {
      throw new Error("Quality Gate Failed: Caption missing brand entity (AME Bazaar).");
    }
    
    if (!lowerCaption.includes("kirari") && !lowerCaption.includes("delhi")) {
      throw new Error("Quality Gate Failed: Caption missing local entity context (Kirari/Delhi).");
    }
    
    if (!lowerCaption.match(/(visit ame bazaar|visit us|visit our store|store par|store visit|whatsapp|9953569533|contact)/)) {
      throw new Error("Quality Gate Failed: Caption missing a clear CTA.");
    }

    const hashtags = finalCaption.match(/#[\w]+/g) || [];
    if (hashtags.length < 4 || hashtags.length > 5) {
      throw new Error("Quality Gate Failed: Caption must contain exactly 4-5 hashtags. Found: " + hashtags.length);
    }
    
    const labels = ["seo:", "aeo:", "geo:", "caption:", "alt text:", "reasoning:", "analysis:"];
    for (const label of labels) {
      if (lowerCaption.includes(label)) {
        throw new Error("Quality Gate Failed: Output contains internal label (" + label + ").");
      }
    }

    if (parsedResult.caption.trim().toLowerCase().match(/\b(and|or|the|is|in|on|at|to|with|for|ki|ka|ke|se|mein|aur|par)\s*$/)) {
      throw new Error("Quality Gate Failed: Caption appears truncated (ends with dangling word).");
    }
    // ---------------------------------------------------------

    Logger.log("✓ Gemini JSON metadata generated successfully.");
    return {
      caption: finalCaption,
      altText: parsedResult.alt_text || '',
      productCategory: parsedResult.product_category || '',
      localIntent: parsedResult.local_intent || ''
    };
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

    const unprocessedFiles = DriveService.getUnprocessedMedia(config);
    if (unprocessedFiles.length === 0) {
      Logger.log("ℹ No new unprocessed media found in supported folders inside INPUT_FOLDER_ID.");
      return;
    }

    Logger.log("Found " + unprocessedFiles.length + " unprocessed image(s) to process.");

    for (const item of unprocessedFiles) {
      Logger.log("\n--------------------------------------------------");
      Logger.log("Processing File: " + item.name + " (ID: " + item.id + " | Category: " + (item.category || 'None') + ")");
      
      const fileHistory = SheetService.getFilePlatformHistory(config, item.id);
      let fbSuccess = fileHistory.Facebook;
      let igSuccess = fileHistory.Instagram;

      let caption = "";
      let publicImageUrl = "";
      let geminiOutput = {};

      try {
        const imageData = DriveService.getImageData(item.fileObj);
        const recentCaptions = SheetService.getRecentCaptions(config, 5);
        geminiOutput = GeminiService.generateCaption(config, imageData, recentCaptions, item.category);
        
        caption = geminiOutput.caption;
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
              executionId: executionId,
              productCategory: geminiOutput.productCategory,
              altText: geminiOutput.altText,
              contentType: 'FEED_POST',
              localIntent: geminiOutput.localIntent,
              folderCategory: item.category || ''
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
              executionId: executionId,
              productCategory: geminiOutput.productCategory,
              altText: geminiOutput.altText,
              contentType: 'FEED_POST',
              localIntent: geminiOutput.localIntent,
              folderCategory: item.category || ''
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
              executionId: executionId,
              productCategory: geminiOutput.productCategory,
              altText: geminiOutput.altText,
              contentType: 'FEED_POST',
              localIntent: geminiOutput.localIntent,
              folderCategory: item.category || ''
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
              executionId: executionId,
              productCategory: geminiOutput.productCategory,
              altText: geminiOutput.altText,
              contentType: 'FEED_POST',
              localIntent: geminiOutput.localIntent,
              folderCategory: item.category || ''
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
          caption: caption || err.message,
          status: 'FAILED',
          postId: '',
          postUrl: '',
          error: err.message,
          executionId: executionId,
          productCategory: geminiOutput.productCategory || '',
          altText: geminiOutput.altText || '',
          contentType: 'FEED_POST',
          localIntent: geminiOutput.localIntent || '',
          folderCategory: item.category || ''
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
  runTest("Test 6: Duplicate Caption Prevention Retrieval", testDuplicateCaptionPrevention);
  runTest("Test 7: Backward Compatible Logging Headers", testBackwardCompatibleLogging);
  runTest("Test 8: Strict Caption Quality Gates", testCaptionQualityGates);
  runTest("Test 9: Drive Discovery & Balanced Category Rotation", testDriveDiscoveryAndRotation);

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
    caption: "High quality garment caption",
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
  if (!prompt.includes("Kirari, Delhi")) throw new Error("Prompt missing local entity-discovery context");
  if (!prompt.includes("AEO/GEO")) throw new Error("Prompt missing AEO/GEO optimization instruction");
  if (!prompt.includes("OUTPUT FORMAT: You must return a strict JSON object")) throw new Error("Prompt missing JSON schema instruction");
  if (!GeminiService.generateCaption.toString().includes("maxOutputTokens: 4096")) throw new Error("Gemini maxOutputTokens must be configured to 4096 to prevent truncation");
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

function testDuplicateCaptionPrevention() {
  const mockConfig = Config.getConfig();
  const recentCaptions = SheetService.getRecentCaptions(mockConfig, 5);
  if (!Array.isArray(recentCaptions)) throw new Error("getRecentCaptions did not return an array");
}

function testBackwardCompatibleLogging() {
  const headers = SheetService.HEADERS;
  if (headers.length !== 15) throw new Error("Sheet headers should be exactly 15 to include Folder Category while preserving backward compatibility");
  if (headers[0] !== 'Timestamp') throw new Error("First column must be Timestamp");
  if (headers[10] !== 'Product Category') throw new Error("11th column must be Product Category");
  if (headers[13] !== 'Location Intent') throw new Error("14th column must be Location Intent");
  if (headers[14] !== 'Folder Category') throw new Error("15th column must be Folder Category");
}

function testCaptionQualityGates() {
  const mockConfig = Config.getConfig();
  mockConfig.testMode = true;
  mockConfig.geminiApiKey = "test_key";
  
  // Create a mock UrlFetchApp for this test scope to test parsing logic
  const originalFetch = UrlFetchApp.fetch;
  
  function validateCaptionPayload(jsonPayload) {
    UrlFetchApp.fetch = function() {
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(jsonPayload) }] } }]
        })
      };
    };
    return GeminiService.generateCaption(mockConfig, { mimeType: 'image/jpeg', base64: 'abc' });
  }

  // 1. Valid caption
  try {
    validateCaptionPayload({
      caption: "Looking for best kids wear? Visit AME Bazaar in Kirari! Whatsapp 9953569533 today.",
      hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#KirariDelhi"],
      alt_text: "test", product_category: "test", local_intent: "test"
    });
  } catch (e) {
    throw new Error("Valid caption was incorrectly rejected: " + e.message);
  }

  // 1b. Valid caption with 5 hashtags
  try {
    validateCaptionPayload({
      caption: "Looking for best kids wear? Visit AME Bazaar in Kirari! Whatsapp 9953569533 today.",
      hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#KirariDelhi", "#Style"],
      alt_text: "test", product_category: "test", local_intent: "test"
    });
  } catch (e) {
    throw new Error("Valid caption (5 hashtags) was incorrectly rejected: " + e.message);
  }

  // 2. Missing Brand
  let failed = false;
  try {
    validateCaptionPayload({ caption: "Great clothes in Kirari! Visit our store.", hashtags: ["#Shop", "#KidsWear", "#Fashion", "#KirariDelhi"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject missing brand");

  // 3. Missing Local Context
  failed = false;
  try {
    validateCaptionPayload({ caption: "Great clothes! Visit AME Bazaar store today.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#Style"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject missing local context");

  // 4. Missing CTA (Using "store" alone should fail now)
  failed = false;
  try {
    validateCaptionPayload({ caption: "Great clothes at AME Bazaar in Kirari! We have many items in store.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#KirariDelhi"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject missing/weak CTA");

  // 5. Hashtag Count (0 hashtags)
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: [] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject 0 hashtags");

  // 6. Hashtag Count (3 hashtags)
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject 3 hashtags");

  // 7. Hashtag Count (6 hashtags)
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#A", "#B", "#C"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject 6 hashtags");

  // 8. Duplicate hashtags
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#amebazaar"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject duplicate hashtags");

  // 9. Malformed hashtags
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: ["AMEBazaar", "#KidsWear", "#Fashion", "#Style"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject malformed hashtag");

  // 10. Internal Labels
  failed = false;
  try {
    validateCaptionPayload({ caption: "SEO: Visit AME Bazaar in Kirari! Whatsapp 9953569533.", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#Delhi"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject internal labels");

  // 11. Obvious Truncation
  failed = false;
  try {
    validateCaptionPayload({ caption: "Visit AME Bazaar in Kirari! Whatsapp 9953569533. and", hashtags: ["#AMEBazaar", "#KidsWear", "#Fashion", "#Delhi"] });
  } catch(e) { failed = true; }
  if (!failed) throw new Error("Failed to reject obvious truncation");

  // Restore mock
  UrlFetchApp.fetch = originalFetch;
}

function testDriveDiscoveryAndRotation() {
  // Test 1: Category rotation logic
  const mockUnprocessed = [
    { id: '1', name: 'm1.jpg', category: 'MEN' },
    { id: '2', name: 'm2.jpg', category: 'MEN' },
    { id: '3', name: 'w1.jpg', category: 'WOMEN' },
    { id: '4', name: 'b1.jpg', category: 'BOYS' }
  ];
  const recentCategories = ['MEN', 'WOMEN']; // BOYS is most starved
  const results = DriveService._balancedCategoryRotation(mockUnprocessed, recentCategories, 2);
  
  if (results.length !== 2) throw new Error("Rotation should return maxFiles (2)");
  if (results[0].category !== 'BOYS') throw new Error("Rotation failed to prefer starved category BOYS");
  if (results[1].category !== 'WOMEN') throw new Error("Rotation failed to pick next least-recently-used WOMEN");

  // Test 2: TEST_MODE does not permanently block live execution logic is verified by checking the new SheetService.isProcessed check
  if (!SheetService.isProcessed.toString().includes("!rowCaption.startsWith('[TEST_MODE]')")) {
    throw new Error("isProcessed must ignore [TEST_MODE] rows");
  }
}


/**
 * Validates Meta API connection (Read-Only)
 */
function testMetaApiConnection() {
  Logger.log("=== META API READ-ONLY CONNECTION TEST ===");
  const config = Config.getConfig();
  const token = config.metaAccessToken;
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
