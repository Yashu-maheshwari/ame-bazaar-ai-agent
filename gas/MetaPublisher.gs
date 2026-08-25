/**
 * AME Bazaar AI Agent - Locked Autonomous Publishing Engine v1
 * File: gas/MetaPublisher.gs
 *
 * Implements the locked pre-publication handler, trigger registration,
 * and safety validation logic for daily automated staging.
 */

const MetaPublisher = {

  // Hard safety lock (MUST REMAIN TRUE)
  AUTOPUBLISH_KILL_SWITCH: true,

  getConn: function() {
    const dbUrl = PropertiesService.getScriptProperties().getProperty('DB_URL');
    const dbUser = PropertiesService.getScriptProperties().getProperty('DB_USER');
    const dbPass = PropertiesService.getScriptProperties().getProperty('DB_PASS');
    if (!dbUrl || !dbUser || !dbPass) {
      throw new Error("Database credentials (DB_URL, DB_USER, DB_PASS) are missing in Script Properties.");
    }
    return Jdbc.getConnection(dbUrl, dbUser, dbPass);
  },

  runQuery: function(sql, params = []) {
    const conn = this.getConn();
    const stmt = conn.prepareStatement(sql);
    params.forEach((p, idx) => {
      stmt.setObject(idx + 1, p);
    });
    const rs = stmt.executeQuery();
    const results = [];
    const meta = rs.getMetaData();
    const colCount = meta.getColumnCount();
    while (rs.next()) {
      const row = {};
      for (let i = 1; i <= colCount; i++) {
        const colName = meta.getColumnName(i);
        const colType = meta.getColumnType(i);
        let val;
        
        // Map common SQL types to appropriate Java getters safely
        if (colType === 4 || colType === -6 || colType === 5) { // INTEGER, TINYINT, SMALLINT
          val = rs.getInt(i);
        } else if (colType === -5) { // BIGINT
          val = rs.getLong(i);
        } else if (colType === 2 || colType === 3 || colType === 8 || colType === 6 || colType === 7) { // NUMERIC, DECIMAL, DOUBLE, FLOAT, REAL
          val = rs.getDouble(i);
        } else if (colType === 16 || colType === -7) { // BOOLEAN, BIT
          val = rs.getBoolean(i);
        } else { // VARCHAR, CHAR, UUID (1111/OTHER), TIMESTAMP, DATE, etc.
          val = rs.getString(i);
        }
        
        if (rs.wasNull()) {
          val = null;
        }
        row[colName] = val;
      }
      results.push(row);
    }
    rs.close();
    stmt.close();
    conn.close();
    return results;
  },

  runUpdate: function(sql, params = []) {
    const conn = this.getConn();
    const stmt = conn.prepareStatement(sql);
    params.forEach((p, idx) => {
      stmt.setObject(idx + 1, p);
    });
    const count = stmt.executeUpdate();
    stmt.close();
    conn.close();
    return count;
  },

  /**
   * Run locked publishing audit and return detailed dry-run status
   */
  runMetaAutoPublisher: function() {
    Logger.log("=== Running LOCKED Meta Auto Publisher Engine ===");

    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    
    // 1. Fetch Today's Queue Items
    const queueSql = "SELECT * FROM content_execution_queue WHERE plan_date = ?::date;";
    const items = this.runQuery(queueSql, [todayStrKolkata]);
    Logger.log("Loaded " + items.length + " execution queue items for today.");

    const results = [];

    items.forEach(item => {
      Logger.log("Evaluating Queue Item: " + item.content_plan_id + " (Quality: " + item.quality_status + ")");

      // A. Quality Gate Gatekeeper
      if (item.quality_status !== 'APPROVED_FOR_AUTOPUBLISH') {
        Logger.log("  ✗ Rejected: Quality status is " + item.quality_status + " (Requires APPROVED_FOR_AUTOPUBLISH)");
        results.push({
          content_plan_id: item.content_plan_id,
          status: 'REJECTED',
          reason: "Quality status not approved (" + item.quality_status + ")"
        });
        return;
      }

      // B. Publish Request Validation
      const validationError = this.validatePublishRequest(item);
      if (validationError) {
        Logger.log("  ✗ Rejected: Validation failed - " + validationError);
        results.push({
          content_plan_id: item.content_plan_id,
          status: 'REJECTED',
          reason: "Validation failed: " + validationError
        });
        return;
      }

      // C. Build Memory Publish Request
      const publishRequest = {
        plan_id: item.content_plan_id,
        platform: item.platform,
        file_id: item.google_drive_file_id,
        media_format: item.format,
        caption: item.hook + "\n\n" + item.angle + "\n\n" + item.cta,
        meta_destination: item.platform === 'Instagram' ? 'Instagram Business Account' : 'Facebook Page'
      };

      // D. Hard safety lock
      if (this.AUTOPUBLISH_KILL_SWITCH) {
        Logger.log("  ✓ Blocked by Safety Lock: Publish request constructed successfully but execution is BLOCKED_BY_KILL_SWITCH.");
        results.push({
          content_plan_id: item.content_plan_id,
          status: 'DRY_RUN / BLOCKED_BY_KILL_SWITCH',
          request: publishRequest
        });
      } else {
        Logger.log("  ✗ CRITICAL ERROR: AUTOPUBLISH_KILL_SWITCH must remain enabled.");
        results.push({
          content_plan_id: item.content_plan_id,
          status: 'REJECTED',
          reason: "Kill switch disabled (unauthorized state)"
        });
      }
    });

    Logger.log("=== Publisher Run Completed ===");
    return results;
  },

  /**
   * Performs schema validation on execution row fields
   */
  validatePublishRequest: function(item) {
    if (!item.google_drive_file_id) return "Missing Google Drive file ID";
    if (!item.platform) return "Missing target platform";
    if (!item.format) return "Missing format type";
    if (!item.hook) return "Missing caption hook";
    if (!item.cta) return "Missing caption CTA";
    
    const validFormats = ['IMAGE', 'REEL', 'CAROUSEL'];
    if (!validFormats.includes(item.format.toUpperCase())) {
      return "Invalid media type: " + item.format;
    }
    
    return null; // All valid
  },

  /**
   * Safe manual single-post execution test that bypasses the global kill switch
   * only for a single explicitly authorized queue item.
   */
  runManualPostTest: function(queueId, testModeOverride) {
    Logger.log("=== Running Integrated MANUAL Meta Post Test ===");
    if (!queueId) {
      return {
        result: 'REJECTED',
        reason: "Missing queue ID"
      };
    }

    // 1. Fetch the exact queue item
    const sql = "SELECT * FROM content_execution_queue WHERE id = ?::uuid;";
    const items = this.runQuery(sql, [queueId]);
    if (items.length === 0) {
      return {
        result: 'REJECTED',
        reason: "Queue item not found for ID: " + queueId
      };
    }
    const item = items[0];

    // 2. Strict MANUAL_TEST_PUBLISH status check
    if (item.approval_status !== 'MANUAL_TEST_PUBLISH') {
      return {
        queueId: queueId,
        approval_status: item.approval_status,
        platform: item.platform,
        file_id: item.google_drive_file_id,
        testMode: true,
        network_write_attempted: false,
        network_write_executed: false,
        result: 'REJECTED',
        reason: "Missing MANUAL_TEST_PUBLISH approval status. Current status: " + item.approval_status
      };
    }

    // 3. Re-run all existing safety gates
    if (item.quality_status !== 'APPROVED_FOR_AUTOPUBLISH') {
      return {
        result: 'REJECTED',
        reason: "Quality status not approved (" + item.quality_status + ")"
      };
    }

    const validationError = this.validatePublishRequest(item);
    if (validationError) {
      return {
        result: 'REJECTED',
        reason: "Validation failed: " + validationError
      };
    }

    // 4. Load config and resolve override
    const config = Config.getConfig();
    const isTestMode = (testModeOverride !== undefined) ? testModeOverride : config.testMode;
    Logger.log("Resolved testMode for manual execution: " + isTestMode + " (Override: " + testModeOverride + ", Global: " + config.testMode + ")");

    let publicImageUrl = "";
    let networkWriteAttempted = false;
    let networkWriteExecuted = false;
    const publishTargets = [];
    const publishResults = [];
    const targetPlatform = item.platform.toUpperCase();

    if (targetPlatform === 'INSTAGRAM' || targetPlatform === 'BOTH') {
      publishTargets.push('INSTAGRAM');
    }
    if (targetPlatform === 'FACEBOOK' || targetPlatform === 'BOTH') {
      publishTargets.push('FACEBOOK');
    }

    const caption = item.hook + "\n\n" + item.angle + "\n\n" + item.cta;

    try {
      // Resolve visual asset URL
      if (isTestMode) {
        publicImageUrl = "https://lh3.googleusercontent.com/d/" + item.google_drive_file_id;
        Logger.log("ℹ [TEST_MODE] Using fallback Drive URL for manual validation: " + publicImageUrl);
      } else {
        const fileObj = DriveApp.getFileById(item.google_drive_file_id);
        const imageData = DriveService.getImageData(fileObj);
        publicImageUrl = CloudinaryService.getPublicImageUrl(config, fileObj, imageData);
        networkWriteAttempted = true;
      }

      // Publish execution
      // Update config object locally for this single call sequence
      const runConfig = { ...config, testMode: isTestMode };

      if (publishTargets.includes('INSTAGRAM')) {
        const igRes = MetaService.publishToInstagram(runConfig, publicImageUrl, caption);
        publishResults.push({ platform: 'INSTAGRAM', res: igRes });
      }
      if (publishTargets.includes('FACEBOOK')) {
        const fbRes = MetaService.publishToFacebook(runConfig, publicImageUrl, caption);
        publishResults.push({ platform: 'FACEBOOK', res: fbRes });
      }
      
      if (!isTestMode) {
        networkWriteExecuted = true;
      }

      return {
        queueId: queueId,
        approval_status: item.approval_status,
        platform: item.platform,
        file_id: item.google_drive_file_id,
        cloudinary_url: publicImageUrl,
        publish_targets: publishTargets,
        testMode: isTestMode,
        network_write_attempted: networkWriteAttempted,
        network_write_executed: networkWriteExecuted,
        result: 'SUCCESS',
        publish_details: publishResults
      };
    } catch (e) {
      return {
        queueId: queueId,
        approval_status: item.approval_status,
        platform: item.platform,
        file_id: item.google_drive_file_id,
        cloudinary_url: publicImageUrl,
        publish_targets: publishTargets,
        testMode: isTestMode,
        network_write_attempted: networkWriteAttempted,
        network_write_executed: networkWriteExecuted,
        result: 'FAILED',
        reason: "Publishing execution failed: " + e.message
      };
    } finally {
      // 9. Emergency restore of approval_status to APPROVED_FOR_AUTOPUBLISH
      try {
        const restoreSql = "UPDATE content_execution_queue SET approval_status = 'APPROVED_FOR_AUTOPUBLISH', updated_at = now() WHERE id = ?::uuid;";
        this.runUpdate(restoreSql, [queueId]);
        Logger.log("✓ Safety restore completed: approval_status reverted to APPROVED_FOR_AUTOPUBLISH.");
      } catch (err) {
        Logger.log("✗ Failed to execute safety restore SQL: " + err.message);
      }
    }
  }
};

/**
 * Wrapper function triggered daily to invoke the locked publisher
 */
function runDailyAutoPublisher() {
  Logger.log("=== Triggering runDailyAutoPublisher wrapper ===");
  MetaPublisher.runMetaAutoPublisher();
}

/**
 * Register daily trigger at 12:00 IST (06:30 UTC) for runDailyAutoPublisher
 */
function setupDailyPublisherTrigger() {
  const functionName = 'runDailyAutoPublisher';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Register daily trigger at 12:00 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(12)
    .nearMinute(0)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runDailyAutoPublisher at 12:00 IST (06:30 UTC).");
}

/**
 * One-time top-level helper to trigger the live manual test post from the dropdown selection list
 */
function triggerLiveManualPost() {
  Logger.log("=== Launching Live Manual Validation Test Post ===");
  const result = MetaPublisher.runManualPostTest("966e6856-0f47-41ce-a658-858a0d49aba6", false);
  Logger.log("Execution Result: " + JSON.stringify(result, null, 2));
}
