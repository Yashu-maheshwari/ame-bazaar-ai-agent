/**
 * AME Bazaar AI Agent - Main Orchestrator & Execution Controller
 * File: gas/Code.gs
 */

/**
 * Main execution function invoked manually or by time-driven trigger
 */
function runAgent() {
  const lock = LockService.getScriptLock();
  try {
    // Acquire lock (wait up to 30 seconds) to prevent duplicate simultaneous executions
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

    // Step 1: Scan Google Drive Input Folder for unprocessed images
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
        // Step 2: Read image binary data
        const imageData = DriveService.getImageData(item.fileObj);

        // Step 3: Generate Hinglish caption via Gemini API
        caption = GeminiService.generateCaption(config, imageData);
        if (config.testMode) {
          caption = "[TEST_MODE] " + caption;
        }

        // Step 4: Generate Public HTTPS Image URL for Meta Graph API
        publicImageUrl = CloudinaryService.getPublicImageUrl(config, item.fileObj, imageData);

        // Step 5: Publish to Facebook Page if not previously posted
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

        // Step 6: Publish to Instagram Feed if not previously posted
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

        // Step 7: Post-Processing & File Movement Decision
        if (fbSuccess && igSuccess) {
          Logger.log("✓ All social platforms published successfully.");
          if (config.postedFolderId && !config.testMode) {
            DriveService.moveFile(item.id, config.postedFolderId);
          } else if (config.testMode) {
            Logger.log("ℹ [TEST_MODE] File left in INPUT_FOLDER_ID for testing repeat runs.");
          }
        } else {
          Logger.log("⚠ Partial or total posting failure. File kept in INPUT_FOLDER_ID for retry.");
          if (config.errorFolderId && !fbSuccess && !igSuccess) {
            // Optional: move to Error folder only if completely failed on all platforms
            // DriveService.moveFile(item.id, config.errorFolderId);
          }
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
 * Setup Time-Driven Scheduled Triggers (11:00, 14:00, 19:00 IST daily)
 */
function setupTriggers() {
  // Delete existing triggers for runAgent to prevent duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runAgent') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create daily scheduled triggers at 11:00, 14:00, 19:00 IST
  ScriptApp.newTrigger('runAgent')
    .timeBased()
    .atHour(11)
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
    .atHour(19)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  Logger.log("✓ Created 3 daily scheduled triggers for runAgent (11:00, 14:00, 19:00 IST).");
}
