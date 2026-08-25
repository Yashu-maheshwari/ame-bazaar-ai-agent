/**
 * AME Bazaar AI Agent - GAS Content Planner Integration Component
 * File: gas/ContentPlanner.gs
 *
 * Integrates performance-driven strategy feedback signals into the daily content planner engine,
 * staging advisory strategy evidence alongside generated content plans, and registers daily triggers.
 */

const ContentPlanner = {

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
   * Retrieves high-confidence performance signals from strategy_feedback_signals
   */
  getReliableStrategyFeedback: function() {
    const sql = `
      SELECT DISTINCT ON (platform, dimension_type, dimension_value) * 
      FROM strategy_feedback_signals 
      WHERE confidence = 'HIGH'
      ORDER BY platform, dimension_type, dimension_value, signal_date DESC;
    `;
    return this.runQuery(sql);
  },

  /**
   * Generates content plans and links matching feedback evidence
   */
  generateDailyContentPlan: function() {
    Logger.log("=== Running Daily Content Planner with Feedback Integration ===");

    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");

    // 1. Fetch latest strategy recommendations
    const stratSql = "SELECT * FROM growth_strategy_recommendations ORDER BY strategy_date DESC LIMIT 1;";
    const strategies = this.runQuery(stratSql);
    if (strategies.length === 0) {
      Logger.log("No growth strategy recommendations found. Exiting planner.");
      return;
    }
    const strategy = strategies[0];

    // 2. Fetch reliable feedback signals
    const signals = this.getReliableStrategyFeedback();
    Logger.log("Loaded " + signals.length + " high-confidence strategy feedback signals.");

    // Define standard fallback daily slot configurations (11:00, 14:00, 19:00 IST)
    const plannedSlots = [
      {
        content_plan_id: "slot_11_00",
        platform: "Instagram",
        format: "IMAGE",
        product_category: "BOYS",
        product_name: "Boys Printed T-Shirt",
        product_ref: "BOYS_T_SHIRT",
        hook: "Looking for trendy kids wear?",
        angle: "Upgrade his style with new casual fits.",
        local_angle: "Visit our local store in Kirari, Delhi today!",
        cta: "Visit AME Bazaar today!",
        strategy_reason: "Targeting boys category for casual weekend styling",
        confidence: strategy.confidence || "HIGH",
        status: "PLANNED"
      },
      {
        content_plan_id: "slot_14_00",
        platform: "Instagram",
        format: "IMAGE",
        product_category: "WOMEN",
        product_name: "Women Kurti Sets",
        product_ref: "WOMEN_KURTI",
        hook: "Looking for elegant womenswear?",
        angle: "Comfortable styles for daily festive vibes.",
        local_angle: "Find the best designer kurtis in Kirari, Delhi.",
        cta: "Visit AME Bazaar today!",
        strategy_reason: "Targeting women category for daily and festive kurtis",
        confidence: strategy.confidence || "HIGH",
        status: "PLANNED"
      },
      {
        content_plan_id: "slot_19_00",
        platform: "Instagram",
        format: "IMAGE",
        product_category: "MEN",
        product_name: "Mens Denim Jeans",
        product_ref: "MEN_JEANS",
        hook: "Looking for smart menswear?",
        angle: "High quality denim with perfect styling fits.",
        local_angle: "Best mens collection in Kirari, Delhi.",
        cta: "Visit AME Bazaar today!",
        strategy_reason: "Targeting men category for everyday styling",
        confidence: strategy.confidence || "HIGH",
        status: "PLANNED"
      }
    ];

    plannedSlots.forEach(plan => {
      // 3. Upsert content plan row
      const upsertPlanSql = `
        INSERT INTO daily_content_plans (
          plan_date, content_plan_id, product_ref, product_name, product_category,
          platform, format, hook, angle, local_angle, cta, strategy_reason, confidence, status, created_at
        ) VALUES (?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
        ON CONFLICT (plan_date, content_plan_id) DO UPDATE SET
          product_ref = EXCLUDED.product_ref,
          product_name = EXCLUDED.product_name,
          product_category = EXCLUDED.product_category,
          platform = EXCLUDED.platform,
          format = EXCLUDED.format,
          hook = EXCLUDED.hook,
          angle = EXCLUDED.angle,
          local_angle = EXCLUDED.local_angle,
          cta = EXCLUDED.cta,
          strategy_reason = EXCLUDED.strategy_reason,
          confidence = EXCLUDED.confidence,
          status = EXCLUDED.status,
          created_at = now();
      `;

      this.runUpdate(upsertPlanSql, [
        todayStrKolkata,
        plan.content_plan_id,
        plan.product_ref,
        plan.product_name,
        plan.product_category,
        plan.platform,
        plan.format,
        plan.hook,
        plan.angle,
        plan.local_angle,
        plan.cta,
        plan.strategy_reason,
        plan.confidence,
        plan.status
      ]);

      // 4. Attach feedback evidence
      const match = signals.find(s => 
        s.platform.toUpperCase() === plan.platform.toUpperCase() &&
        (
          (s.dimension_type === 'category' && s.dimension_value.toUpperCase() === plan.product_category.toUpperCase()) ||
          (s.dimension_type === 'format' && s.dimension_value.toUpperCase() === plan.format.toUpperCase())
        )
      );

      let signalType = 'NO RELIABLE PERFORMANCE SIGNALS';
      let evidenceData = null;
      let platform = plan.platform;
      let dimType = 'category';
      let dimValue = plan.product_category;
      let relPerf = null;
      let sampleSize = 0;
      let confidence = 'LOW';

      if (match) {
        signalType = match.signal_type;
        platform = match.platform;
        dimType = match.dimension_type;
        dimValue = match.dimension_value;
        relPerf = Number(match.relative_performance);
        sampleSize = Number(match.sample_size);
        confidence = match.confidence;
        evidenceData = match.evidence;
      }

      const upsertEvidenceSql = `
        INSERT INTO content_plan_strategy_evidence (
          plan_date, content_plan_id, signal_type, platform, dimension_type, dimension_value,
          relative_performance, sample_size, confidence, evidence, created_at
        ) VALUES (?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, now())
        ON CONFLICT (plan_date, content_plan_id) DO UPDATE SET
          signal_type = EXCLUDED.signal_type,
          platform = EXCLUDED.platform,
          dimension_type = EXCLUDED.dimension_type,
          dimension_value = EXCLUDED.dimension_value,
          relative_performance = EXCLUDED.relative_performance,
          sample_size = EXCLUDED.sample_size,
          confidence = EXCLUDED.confidence,
          evidence = EXCLUDED.evidence,
          created_at = now();
      `;

      this.runUpdate(upsertEvidenceSql, [
        todayStrKolkata,
        plan.content_plan_id,
        signalType,
        platform,
        dimType,
        dimValue,
        relPerf,
        sampleSize,
        confidence,
        evidenceData ? JSON.stringify(evidenceData) : null
      ]);

      Logger.log("  ✓ Linked Strategy Evidence to " + plan.content_plan_id + ": Status=" + signalType);
    });

    Logger.log("=== Content Planning Run Completed Successfully ===");
  }
};

/**
 * Wrapper to run daily content planner execution
 */
function runDailyPlanner() {
  Logger.log("=== Triggering runDailyPlanner wrapper ===");
  try {
    ContentPlanner.generateDailyContentPlan();
    Logger.log("✓ Daily planner run completed successfully.");
  } catch (e) {
    Logger.log("✗ Daily planner run failed: " + e.message);
  }
}

/**
 * Register daily trigger at 10:30 IST (05:00 UTC) for runDailyPlanner
 */
function setupDailyPlannerTrigger() {
  const functionName = 'runDailyPlanner';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 10:30 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(10)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runDailyPlanner at 10:30 IST (05:00 UTC).");
}
