/**
 * AME Bazaar AI Agent - GAS Strategy Brain Feedback Loop
 * File: gas/StrategyFeedback.gs
 *
 * Generates statistically validated performance signals for the strategy optimization engine,
 * and sets up daily time-driven execution triggers.
 */

const StrategyFeedback = {

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
   * Main function to read platform_performance_aggregates and upsert feedback table
   */
  updateStrategyFeedback: function() {
    Logger.log("=== Starting Strategy Brain Feedback Signal Generation ===");

    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    
    // Load high-confidence performance aggregates
    const sql = `
      SELECT * FROM platform_performance_aggregates 
      WHERE confidence = 'HIGH' AND analysis_period = 'ALL';
    `;
    const aggregates = this.runQuery(sql);
    Logger.log("Loaded " + aggregates.length + " high-confidence aggregates for signal extraction.");

    if (aggregates.length === 0) {
      Logger.log("NO RELIABLE SIGNALS YET (Zero high-confidence aggregates found).");
      return;
    }

    aggregates.forEach(agg => {
      const relPerf = Number(agg.relative_performance || 1.0);
      const breakoutRate = Number(agg.breakout_rate || 0.0);
      
      let signalType = 'ABOVE_BASELINE';
      if (relPerf >= 1.5) {
        signalType = 'TOP_PERFORMER';
      } else if (relPerf <= 1.0 && breakoutRate >= 0.2) {
        signalType = 'EMERGING';
      } else if (relPerf <= 1.0) {
        return; 
      }

      const desc = agg.dimension_value + " / " + agg.dimension_type + " / " + agg.platform + 
                    " is performing " + relPerf.toFixed(1) + "x platform baseline with HIGH confidence.";
      
      const evidence = {
        statement: desc,
        sample_size: agg.sample_size,
        median_reach: agg.median_reach,
        median_interactions: agg.median_interactions,
        breakout_rate: agg.breakout_rate
      };

      const upsertSql = `
        INSERT INTO strategy_feedback_signals (
          signal_date, platform, dimension_type, dimension_value, sample_size,
          median_reach, median_interactions, relative_performance, breakout_rate,
          confidence, signal_type, evidence, created_at
        ) VALUES (?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, now())
        ON CONFLICT (signal_date, platform, dimension_type, dimension_value) DO UPDATE SET
          sample_size = EXCLUDED.sample_size,
          median_reach = EXCLUDED.median_reach,
          median_interactions = EXCLUDED.median_interactions,
          relative_performance = EXCLUDED.relative_performance,
          breakout_rate = EXCLUDED.breakout_rate,
          confidence = EXCLUDED.confidence,
          signal_type = EXCLUDED.signal_type,
          evidence = EXCLUDED.evidence,
          created_at = now();
      `;

      this.runUpdate(upsertSql, [
        todayStrKolkata,
        agg.platform,
        agg.dimension_type,
        agg.dimension_value,
        agg.sample_size,
        agg.median_reach,
        agg.median_interactions,
        agg.relative_performance,
        agg.breakout_rate,
        agg.confidence,
        signalType,
        JSON.stringify(evidence)
      ]);
      
      Logger.log("  ✓ Generated Signal: " + desc);
    });

    Logger.log("=== Feedback Loop Generation Completed ===");
  },

  /**
   * READ-ONLY fetch of today's generated signals for Strategy Brain consumption
   */
  getStrategyFeedbackSignals: function() {
    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
    const sql = "SELECT * FROM strategy_feedback_signals WHERE signal_date = ?::date;";
    return this.runQuery(sql, [todayStrKolkata]);
  }
};

/**
 * Wrapper function triggered daily to invoke the strategy feedback update
 */
function runDailyStrategyFeedback() {
  Logger.log("=== Triggering runDailyStrategyFeedback wrapper ===");
  try {
    StrategyFeedback.updateStrategyFeedback();
    Logger.log("✓ Strategy feedback updated successfully.");
  } catch (e) {
    Logger.log("✗ Strategy feedback update failed: " + e.message);
  }
}

/**
 * Register daily trigger at 12:45 IST (07:15 UTC) for runDailyStrategyFeedback
 */
function setupDailyStrategyFeedbackTrigger() {
  const functionName = 'runDailyStrategyFeedback';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 12:45 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(12)
    .nearMinute(45)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runDailyStrategyFeedback at 12:45 IST (07:15 UTC).");
}
