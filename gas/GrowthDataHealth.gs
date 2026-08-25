/**
 * AME Bazaar AI Agent - GAS Growth System Data Accumulation Health Monitor
 * File: gas/GrowthDataHealth.gs
 *
 * Implements a read-only validation check to audit data collection rates,
 * categories/formats coverage, and general strategy feedback pipeline health, and registers triggers.
 */

const GrowthDataHealth = {

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

  /**
   * Evaluates current system health parameters
   */
  getGrowthDataHealth: function() {
    Logger.log("=== Evaluating Growth System Data Accumulation Health ===");

    const todayStrKolkata = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");

    // 1. Fetch raw insights summary
    const postsSql = `
      SELECT 
        platform,
        published_at,
        total_interactions,
        platform_post_id
      FROM post_performance_insights;
    `;
    const posts = this.runQuery(postsSql);

    // 2. Fetch category/format aggregates mapping
    const aggSql = "SELECT * FROM platform_performance_aggregates WHERE analysis_period = 'ALL';";
    const aggregates = this.runQuery(aggSql);

    // 3. Fetch strategy signals
    const signalSql = "SELECT * FROM strategy_feedback_signals;";
    const signals = this.runQuery(signalSql);

    // 4. Fetch latest readiness state
    const readinessSql = "SELECT readiness FROM strategy_decision_readiness ORDER BY evaluation_date DESC LIMIT 1;";
    const readinessRes = this.runQuery(readinessSql);
    const readinessState = readinessRes.length > 0 ? readinessRes[0].readiness : 'NOT_READY';

    let instagramPosts = 0;
    let facebookPosts = 0;
    let postsLast7Days = 0;
    let postsLast30Days = 0;
    let oldestRecord = null;
    let newestRecord = null;
    const warnings = [];

    const now = new Date();

    posts.forEach(post => {
      const platNorm = (post.platform || '').toUpperCase();
      if (platNorm.includes('INSTAGRAM') || platNorm.includes('IG')) instagramPosts++;
      else if (platNorm.includes('FACEBOOK') || platNorm.includes('FB')) facebookPosts++;

      if (post.published_at) {
        const pubDate = new Date(post.published_at);
        if (!oldestRecord || pubDate < oldestRecord) oldestRecord = pubDate;
        if (!newestRecord || pubDate > newestRecord) newestRecord = pubDate;

        const diffDays = (now - pubDate) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) postsLast7Days++;
        if (diffDays <= 30) postsLast30Days++;
      }
    });

    let mappedPosts = 0;
    let unmappedPosts = 0;
    let categoryCoverageGe3 = 0;
    let categoryCoverageGe5 = 0;
    let formatCoverageGe5 = 0;

    aggregates.forEach(agg => {
      const count = Number(agg.sample_size || 0);
      if (agg.dimension_type === 'category') {
        if (agg.dimension_value === 'UNMAPPED') unmappedPosts += count;
        else mappedPosts += count;

        if (count >= 3) categoryCoverageGe3++;
        if (count >= 5) categoryCoverageGe5++;
      } else if (agg.dimension_type === 'format') {
        if (count >= 5) formatCoverageGe5++;
      }
    });

    let highConfidenceSignals = 0;
    let lowConfidenceSignals = 0;

    signals.forEach(sig => {
      if (sig.confidence === 'HIGH') highConfidenceSignals++;
      else lowConfidenceSignals++;
    });

    // Evaluate health state
    let healthState = 'DATA_INSUFFICIENT';
    let pipelineStatus = 'DATA_PIPELINE_INACTIVE';

    if (posts.length > 0) {
      pipelineStatus = 'DATA_PIPELINE_ACTIVE';
    }

    if (posts.length < 15) {
      warnings.push("Overall sample size is low (" + posts.length + " posts). Min required: 15.");
    }
    if (categoryCoverageGe5 < 2) {
      warnings.push("Fewer than 2 categories have baseline samples (>= 5 posts).");
    }
    if (postsLast7Days === 0) {
      warnings.push("No posts collected within the last 7 days.");
    }
    if (highConfidenceSignals === 0) {
      warnings.push("Zero high confidence strategy signals have been extracted.");
    }

    if (warnings.length === 0 && readinessState === 'READY_FOR_REVIEW') {
      healthState = 'DATA_HEALTHY';
    } else if (posts.length >= 8) {
      healthState = 'DATA_ACCUMULATING';
    }

    const healthSummary = {
      health_state: healthState,
      instagram_posts: instagramPosts,
      facebook_posts: facebookPosts,
      posts_last_7_days: postsLast7Days,
      posts_last_30_days: postsLast30Days,
      mapped_posts: mappedPosts,
      unmapped_posts: unmappedPosts,
      high_confidence_signals: highConfidenceSignals,
      low_confidence_signals: lowConfidenceSignals,
      category_coverage: { ge_3: categoryCoverageGe3, ge_5: categoryCoverageGe5 },
      format_coverage: { ge_5: formatCoverageGe5 },
      readiness_state: readinessState,
      oldest_record: oldestRecord ? Utilities.formatDate(oldestRecord, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss") : null,
      newest_record: newestRecord ? Utilities.formatDate(newestRecord, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss") : null,
      pipeline_status: pipelineStatus,
      warnings: warnings,
      evaluated_at: todayStrKolkata
    };

    Logger.log("System Health State: " + healthState);
    Logger.log("Pipeline status: " + pipelineStatus);
    Logger.log("Warnings: " + warnings.join("; "));

    return healthSummary;
  }
};

/**
 * Wrapper to run daily content growth health audits
 */
function runDailyGrowthDataHealth() {
  Logger.log("=== Triggering runDailyGrowthDataHealth wrapper ===");
  try {
    GrowthDataHealth.getGrowthDataHealth();
    Logger.log("✓ Daily growth data health evaluation completed.");
  } catch (e) {
    Logger.log("✗ Daily growth data health evaluation failed: " + e.message);
  }
}

/**
 * Register daily trigger at 13:15 IST (07:45 UTC) for runDailyGrowthDataHealth
 */
function setupDailyGrowthDataHealthTrigger() {
  const functionName = 'runDailyGrowthDataHealth';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 13:15 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(13)
    .nearMinute(15)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runDailyGrowthDataHealth at 13:15 IST (07:45 UTC).");
}
