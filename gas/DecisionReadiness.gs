/**
 * AME Bazaar AI Agent - GAS Strategy Feedback Decision Readiness Monitor
 * File: gas/DecisionReadiness.gs
 *
 * Implements the read-only analytics validation layer to inspect statistical strength
 * of collected feedback before allowing automated allocation optimization, and daily triggers.
 */

const DecisionReadiness = {

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
   * Main function evaluating readiness state and upserting logs
   */
  getStrategyDecisionReadiness: function() {
    Logger.log("=== Running Strategy Decision Readiness Monitor ===");

    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");

    // 1. Query overall post counts and category/format distribution
    const aggSql = "SELECT * FROM platform_performance_aggregates WHERE analysis_period = 'ALL';";
    const aggregates = this.runQuery(aggSql);

    // 2. Query high-confidence signals count
    const signalSql = "SELECT * FROM strategy_feedback_signals WHERE confidence = 'HIGH';";
    const signals = this.runQuery(signalSql);

    let totalPosts = 0;
    const categorySampleSizes = {};
    const formatSampleSizes = {};
    const strongestSignals = [];
    const reasons = [];
    let establishedBaselinesCount = 0;

    aggregates.forEach(agg => {
      const count = Number(agg.sample_size || 0);
      if (agg.dimension_type === 'category') {
        categorySampleSizes[agg.dimension_value] = count;
        totalPosts += count;
        if (count >= 5) establishedBaselinesCount++;
      } else if (agg.dimension_type === 'format') {
        formatSampleSizes[agg.dimension_value] = count;
      }
    });

    signals.forEach(sig => {
      strongestSignals.push({
        platform: sig.platform,
        dimension: sig.dimension_value,
        relative_performance: Number(sig.relative_performance),
        type: sig.signal_type
      });
    });

    // Determine readiness status using conservative thresholds
    let readiness = 'NOT_READY';
    let platformStatus = 'INSUFFICIENT_DATA';

    if (totalPosts === 0) {
      reasons.push("Zero posts analyzed across all categories.");
    } else if (totalPosts < 10) {
      reasons.push("Overall post count (" + totalPosts + ") is below conservative minimum threshold (10).");
    }

    if (signals.length === 0) {
      reasons.push("No HIGH confidence feedback signals have been generated.");
    }

    if (establishedBaselinesCount < 2) {
      reasons.push("Fewer than 2 categories have established baselines (sample size >= 5).");
    }

    if (reasons.length === 0) {
      readiness = 'READY_FOR_REVIEW';
      platformStatus = 'ESTABLISHED_BASELINE';
    } else if (signals.length > 0 && totalPosts >= 8) {
      readiness = 'EARLY_SIGNAL';
      platformStatus = 'EARLY_DATA_DETECTED';
    }

    const missingEvidence = reasons;

    const evaluationResult = {
      readiness: readiness,
      platform_status: platformStatus,
      total_posts: totalPosts,
      reliable_signals: signals.length,
      category_sample_sizes: categorySampleSizes,
      format_sample_sizes: formatSampleSizes,
      strongest_signals: strongestSignals,
      missing_evidence: missingEvidence,
      reasons: reasons,
      evaluated_at: todayStrKolkata
    };

    Logger.log("Readiness Decision: " + readiness);
    Logger.log("Total posts evaluated: " + totalPosts);
    Logger.log("Reliable signals count: " + signals.length);

    // Upsert readiness log into Supabase
    const upsertSql = `
      INSERT INTO strategy_decision_readiness (
        evaluation_date, readiness, platform_status, total_posts, reliable_signal_count, evidence, created_at
      ) VALUES (?::date, ?, ?, ?, ?, ?::jsonb, now())
      ON CONFLICT (evaluation_date) DO UPDATE SET
        readiness = EXCLUDED.readiness,
        platform_status = EXCLUDED.platform_status,
        total_posts = EXCLUDED.total_posts,
        reliable_signal_count = EXCLUDED.reliable_signal_count,
        evidence = EXCLUDED.evidence,
        created_at = now();
    `;

    this.runUpdate(upsertSql, [
      todayStrKolkata,
      readiness,
      platformStatus,
      totalPosts,
      signals.length,
      JSON.stringify(evaluationResult)
    ]);

    return evaluationResult;
  }
};

/**
 * Wrapper function triggered daily to evaluate strategy readiness
 */
function runDailyDecisionReadiness() {
  Logger.log("=== Triggering runDailyDecisionReadiness wrapper ===");
  try {
    DecisionReadiness.getStrategyDecisionReadiness();
    Logger.log("✓ Daily decision readiness evaluation completed.");
  } catch (e) {
    Logger.log("✗ Daily decision readiness evaluation failed: " + e.message);
  }
}

/**
 * Register daily trigger at 13:00 IST (07:30 UTC) for runDailyDecisionReadiness
 */
function setupDailyDecisionReadinessTrigger() {
  const functionName = 'runDailyDecisionReadiness';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 13:00 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(13)
    .nearMinute(0)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runDailyDecisionReadiness at 13:00 IST (07:30 UTC).");
}
