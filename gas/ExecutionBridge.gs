/**
 * AME Bazaar AI Agent - GAS Autonomous Execution Quality Gate Audit Component
 * File: gas/ExecutionBridge.gs
 *
 * Performs deterministic pre-publication audit checks on resolved content plans before staging them,
 * and sets up daily time-driven execution triggers.
 */

const ExecutionBridge = {
  
  // Kill Switch state (Global Safety Rule)
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
        row[meta.getColumnName(i)] = rs.getObject(i);
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
   * Run deterministic quality audit for a resolved content plan
   */
  verifyExecutionQualityGate: function(planId) {
    Logger.log("=== Running Execution Quality Gate Audit for Plan ID: " + planId + " ===");

    // 1. Fetch Plan Details
    const planSql = "SELECT * FROM daily_content_plans WHERE id = ?::uuid;";
    const plans = this.runQuery(planSql, [planId]);
    if (plans.length === 0) {
      Logger.log("  ✗ Plan not found.");
      return { success: false, error: "Plan not found" };
    }
    const plan = plans[0];

    // 2. Fetch File Resolution Details
    const resSql = "SELECT * FROM file_id_resolutions WHERE plan_id = ?::uuid;";
    const resolutions = this.runQuery(resSql, [planId]);
    const resolution = resolutions.length > 0 ? resolutions[0] : null;

    // 3. Fetch Selection & Enriched Metadata
    let driveAsset = null;
    if (resolution && resolution.google_drive_file_id) {
      const assetSql = "SELECT * FROM drive_assets WHERE google_drive_file_id = ?;";
      const assets = this.runQuery(assetSql, [resolution.google_drive_file_id]);
      if (assets.length > 0) driveAsset = assets[0];
    }

    let score = 0;
    const checks = {};
    let isCriticalPass = true;
    let criticalErrors = [];

    // --- QUALITY CHECK 1: Asset Resolution (15 points) ---
    if (resolution && resolution.google_drive_file_id && resolution.resolution_status === 'RESOLVED') {
      checks.asset_resolution = "PASS";
      score += 15;
    } else {
      checks.asset_resolution = "FAIL";
      isCriticalPass = false;
      criticalErrors.push("Missing/unresolved Google Drive asset reference");
    }

    // --- QUALITY CHECK 2: Asset Accessibility & Mime Validation (15 points) ---
    let fileObj = null;
    let mimeType = null;
    let fileSize = 0;
    if (checks.asset_resolution === "PASS") {
      try {
        fileObj = DriveApp.getFileById(resolution.google_drive_file_id);
        mimeType = fileObj.getMimeType();
        fileSize = fileObj.getSize();
        
        if (mimeType.indexOf("image/") === 0 || mimeType.indexOf("video/") === 0) {
          checks.asset_accessibility = "PASS";
          score += 15;
        } else {
          checks.asset_accessibility = "FAIL";
          isCriticalPass = false;
          criticalErrors.push("Unsupported MIME type: " + mimeType);
        }
      } catch (e) {
        checks.asset_accessibility = "FAIL";
        isCriticalPass = false;
        criticalErrors.push("Google Drive asset is inaccessible or deleted: " + e.message);
      }
    } else {
      checks.asset_accessibility = "UNKNOWN";
    }

    // --- QUALITY CHECK 3: Format Compatibility (15 points) ---
    if (checks.asset_accessibility === "PASS") {
      const plannedFormat = (plan.format || '').toUpperCase();
      if (plannedFormat === 'REEL' && mimeType.indexOf("video/") === 0) {
        checks.format_compatibility = "PASS";
        score += 15;
      } else if (plannedFormat === 'IMAGE' && mimeType.indexOf("image/") === 0) {
        checks.format_compatibility = "PASS";
        score += 15;
      } else if (plannedFormat === 'CAROUSEL' && mimeType.indexOf("image/") === 0) {
        checks.format_compatibility = "PASS";
        score += 15;
      } else {
        checks.format_compatibility = "FAIL";
        isCriticalPass = false;
        criticalErrors.push("Format mismatch: Planned " + plannedFormat + " but file is " + mimeType);
      }
    } else {
      checks.format_compatibility = "UNKNOWN";
    }

    // --- QUALITY CHECK 4: Caption / Content Structure (20 points) ---
    checks.content_hook = plan.hook ? "PASS" : "FAIL";
    checks.content_cta = plan.cta ? "PASS" : "FAIL";
    checks.content_strategy = plan.strategy_reason ? "PASS" : "FAIL";
    checks.content_local_angle = plan.local_angle ? "PASS" : "FAIL";

    if (checks.content_hook === "PASS") score += 5;
    if (checks.content_cta === "PASS") score += 5;
    if (checks.content_strategy === "PASS") score += 5;
    if (checks.content_local_angle === "PASS") score += 5;

    // --- QUALITY CHECK 5: Metadata Audience Consistency (20 points) ---
    if (driveAsset) {
      const planCategory = (plan.product_category || '').toUpperCase();
      const assetAudience = (driveAsset.gender_or_audience || '').toUpperCase();
      
      let match = false;
      if (planCategory === 'GIRLS' && assetAudience === 'GIRLS') match = true;
      else if (planCategory === 'BOYS' && assetAudience === 'BOYS') match = true;
      else if (planCategory === 'WOMEN' && assetAudience === 'WOMEN') match = true;
      else if (planCategory === 'MEN' && assetAudience === 'MEN') match = true;
      else if (planCategory === 'BABY' && assetAudience === 'BABY') match = true;
      else if (planCategory === 'FAMILY' && (assetAudience === 'FAMILY' || assetAudience === 'UNISEX')) match = true;

      if (match) {
        checks.metadata_consistency = "PASS";
        score += 20;
      } else {
        checks.metadata_consistency = "FAIL";
        isCriticalPass = false;
        criticalErrors.push("Audience mismatch: Plan category is " + planCategory + " but asset is " + assetAudience);
      }
    } else {
      checks.metadata_consistency = "UNKNOWN";
    }

    // --- QUALITY CHECK 6: Kill Switch check (15 points) ---
    if (this.AUTOPUBLISH_KILL_SWITCH) {
      checks.kill_switch = "BLOCKED";
      score += 15;
    } else {
      checks.kill_switch = "ACTIVE";
      score += 15;
    }

    const qualityStatus = (isCriticalPass && criticalErrors.length === 0) ? 'APPROVED_FOR_AUTOPUBLISH' : 'NEEDS_REVIEW';
    const executionStatus = this.AUTOPUBLISH_KILL_SWITCH ? 'BLOCKED_BY_KILL_SWITCH' : (qualityStatus === 'APPROVED_FOR_AUTOPUBLISH' ? 'READY_TO_PUBLISH' : 'BLOCKED_BY_QUALITY_GATE');
    const errMsg = criticalErrors.join("; ");

    Logger.log("  Audit Score: " + score + "/100");
    Logger.log("  Quality Status: " + qualityStatus);
    Logger.log("  Execution Status: " + executionStatus);

    const upsertSql = `
      INSERT INTO content_execution_queue (
        execution_id, plan_date, content_plan_id, product_ref, product_name, product_category,
        platform, format, hook, angle, local_angle, cta, strategy_reason, google_drive_file_id,
        resolution_status, execution_status, quality_score, quality_status, approval_status, error_message, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'PENDING_APPROVAL', $19, now(), now())
      ON CONFLICT (plan_date, content_plan_id) DO UPDATE SET
        execution_id = EXCLUDED.execution_id,
        google_drive_file_id = EXCLUDED.google_drive_file_id,
        resolution_status = EXCLUDED.resolution_status,
        execution_status = EXCLUDED.execution_status,
        quality_score = EXCLUDED.quality_score,
        quality_status = EXCLUDED.quality_status,
        error_message = EXCLUDED.error_message,
        updated_at = now();
    `;

    this.runUpdate(upsertSql, [
      plan.content_plan_id + "_" + todayStr(),
      plan.plan_date,
      plan.content_plan_id,
      plan.product_ref,
      plan.product_name,
      plan.product_category,
      plan.platform || 'Instagram',
      plan.format,
      plan.hook,
      plan.angle,
      plan.local_angle,
      plan.cta,
      plan.strategy_reason,
      resolution ? resolution.google_drive_file_id : null,
      resolution ? resolution.resolution_status : 'UNRESOLVED',
      executionStatus,
      score,
      qualityStatus,
      errMsg
    ]);

    return {
      success: true,
      score: score,
      qualityStatus: qualityStatus,
      executionStatus: executionStatus,
      error: errMsg,
      checks: checks
    };
  }
};

function todayStr() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
}

/**
 * Wrapper to run daily content quality gate audits for today's plans
 */
function runDailyExecutionBridge() {
  const todayStrKolkata = todayStr();
  Logger.log("=== Running Daily Execution Bridge for " + todayStrKolkata + " ===");

  const planSql = "SELECT id, content_plan_id FROM daily_content_plans WHERE plan_date = ?::date;";
  const plans = ExecutionBridge.runQuery(planSql, [todayStrKolkata]);
  Logger.log("Loaded " + plans.length + " content plans for today.");

  let successCount = 0;
  let failCount = 0;

  plans.forEach(plan => {
    try {
      const res = ExecutionBridge.verifyExecutionQualityGate(plan.id);
      if (res.success) {
        successCount++;
        Logger.log("  ✓ Plan " + plan.content_plan_id + " audited successfully. Score: " + res.score);
      } else {
        failCount++;
        Logger.log("  ✗ Plan " + plan.content_plan_id + " audit failed: " + res.error);
      }
    } catch (e) {
      failCount++;
      Logger.log("  ✗ Exception during plan audit: " + e.message);
    }
  });

  Logger.log("=== Daily Execution Bridge Completed. Audited: " + successCount + ", Failed: " + failCount + " ===");
}

/**
 * Register time-driven daily trigger for runDailyExecutionBridge at 11:30 IST (06:00 UTC)
 */
function setupDailyExecutionBridgeTrigger() {
  const functionName = 'runDailyExecutionBridge';
  
  // Clean up any duplicate triggers targeting this function
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed old trigger for " + functionName);
    }
  }

  // Create trigger daily at 11:30 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(11)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created time-driven daily trigger for runDailyExecutionBridge at 11:30 IST (06:00 UTC).");
}
