/**
 * AME Bazaar AI Agent - GAS Performance Aggregator Component
 * File: gas/PerformanceAggregator.gs
 *
 * Aggregates post-level metrics into structured platform, category, format, and time insights,
 * and sets up daily time-driven execution triggers.
 */

const PerformanceAggregator = {

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
   * Helper to calculate median of an array of numbers
   */
  calculateMedian: function(values) {
    if (!values || values.length === 0) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
  },

  /**
   * Run daily performance aggregation and write to platform_performance_aggregates
   */
  aggregatePerformanceMetrics: function() {
    Logger.log("=== Starting Performance Insights Aggregator ===");

    const querySql = `
      SELECT 
        i.platform_post_id,
        i.platform,
        i.published_at,
        i.reach,
        i.impressions,
        i.likes,
        i.comments,
        i.shares,
        i.saves,
        i.total_interactions,
        i.facebook_clicks,
        COALESCE(p.product_category, a.gender_or_audience, 'UNMAPPED') as category,
        COALESCE(p.format, i.media_type, 'UNMAPPED') as format,
        to_char(COALESCE(p.plan_date + COALESCE(p.slot_time, '00:00:00'::time), i.published_at) AT TIME ZONE 'Asia/Kolkata', 'HH24:00') as posting_hour
      FROM post_performance_insights i
      LEFT JOIN platform_publish_results r ON i.platform_post_id = r.platform_post_id
      LEFT JOIN content_execution_queue q ON r.execution_id::text = q.execution_id
      LEFT JOIN daily_content_plans p ON q.content_plan_id::uuid = p.id
      LEFT JOIN drive_assets a ON q.google_drive_file_id = a.google_drive_file_id;
    `;
    const rawPosts = this.runQuery(querySql);
    Logger.log("Retrieved " + rawPosts.length + " posts for aggregation.");

    if (rawPosts.length === 0) {
      Logger.log("No data available for aggregation.");
      return;
    }

    const periods = ['7D', '30D', 'ALL'];
    const now = new Date();

    periods.forEach(period => {
      const periodPosts = rawPosts.filter(post => {
        if (!post.published_at) return false;
        const pubDate = new Date(post.published_at);
        const diffDays = (now - pubDate) / (1000 * 60 * 60 * 24);
        if (period === '7D' && diffDays > 7) return false;
        if (period === '30D' && diffDays > 30) return false;
        return true;
      });

      const platforms = ['Instagram', 'Facebook'];
      platforms.forEach(platform => {
        const platformPosts = periodPosts.filter(p => {
          const platNorm = p.platform.toUpperCase();
          if (platform === 'Instagram' && (platNorm.includes('INSTAGRAM') || platNorm.includes('IG'))) return true;
          if (platform === 'Facebook' && (platNorm.includes('FACEBOOK') || platNorm.includes('FB'))) return true;
          return false;
        });

        if (platformPosts.length === 0) return;

        const platformReaches = platformPosts.map(p => Number(p.reach)).filter(v => !isNaN(v) && v !== null);
        const platformInteractions = platformPosts.map(p => Number(p.total_interactions || p.likes || 0)).filter(v => !isNaN(v));
        
        const baselineReach = this.calculateMedian(platformReaches) || 1.0;
        const baselineInteractions = this.calculateMedian(platformInteractions) || 1.0;

        const breakoutThresholdReach = baselineReach * 2;
        const breakoutThresholdInteractions = baselineInteractions * 2;

        const aggregateGroup = (groupPosts, dimType, dimValue) => {
          const sampleSize = groupPosts.length;
          const reaches = groupPosts.map(p => Number(p.reach)).filter(v => !isNaN(v) && v !== null);
          const interactions = groupPosts.map(p => Number(p.total_interactions || p.likes || 0)).filter(v => !isNaN(v));
          
          const medianReach = this.calculateMedian(reaches);
          const medianInteractions = this.calculateMedian(interactions);

          const engagementRates = groupPosts.map(p => {
            const reachVal = Number(p.reach || p.impressions || 0);
            if (reachVal <= 0) return null;
            const interVal = Number(p.total_interactions || p.likes || 0);
            return interVal / reachVal;
          }).filter(v => v !== null);

          const shareRates = groupPosts.map(p => {
            const reachVal = Number(p.reach || p.impressions || 0);
            if (reachVal <= 0) return null;
            const shareVal = Number(p.shares || 0);
            return shareVal / reachVal;
          }).filter(v => v !== null);

          const saveRates = groupPosts.map(p => {
            const reachVal = Number(p.reach || p.impressions || 0);
            if (reachVal <= 0) return null;
            const saveVal = Number(p.saves || 0);
            return saveVal / reachVal;
          }).filter(v => v !== null);

          const medianEngagementRate = this.calculateMedian(engagementRates);
          const shareRate = this.calculateMedian(shareRates);
          const saveRate = this.calculateMedian(saveRates);

          let breakoutCount = 0;
          groupPosts.forEach(p => {
            const rVal = Number(p.reach || 0);
            const iVal = Number(p.total_interactions || p.likes || 0);
            if (rVal >= breakoutThresholdReach || iVal >= breakoutThresholdInteractions) {
              breakoutCount++;
            }
          });
          const breakoutRate = sampleSize > 0 ? breakoutCount / sampleSize : 0;

          const relativePerformance = medianReach && baselineReach ? medianReach / baselineReach : 1.0;

          let classification = 'INSUFFICIENT_DATA';
          let confidence = 'LOW';
          if (sampleSize >= 5) {
            classification = 'BASELINE_ESTABLISHED';
            confidence = 'HIGH';
          } else if (sampleSize >= 3) {
            classification = 'EARLY_SIGNAL';
            confidence = 'MEDIUM';
          }

          const upsertSql = `
            INSERT INTO platform_performance_aggregates (
              platform, dimension_type, dimension_value, analysis_period, sample_size,
              median_reach, median_interactions, median_engagement_rate, share_rate, save_rate,
              breakout_count, breakout_rate, relative_performance, confidence, classification, calculated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
            ON CONFLICT (platform, dimension_type, dimension_value, analysis_period) DO UPDATE SET
              sample_size = EXCLUDED.sample_size,
              median_reach = EXCLUDED.median_reach,
              median_interactions = EXCLUDED.median_interactions,
              median_engagement_rate = EXCLUDED.median_engagement_rate,
              share_rate = EXCLUDED.share_rate,
              save_rate = EXCLUDED.save_rate,
              breakout_count = EXCLUDED.breakout_count,
              breakout_rate = EXCLUDED.breakout_rate,
              relative_performance = EXCLUDED.relative_performance,
              confidence = EXCLUDED.confidence,
              classification = EXCLUDED.classification,
              calculated_at = now();
          `;

          this.runUpdate(upsertSql, [
            platform, dimType, dimValue, period, sampleSize,
            medianReach, medianInteractions, medianEngagementRate, shareRate, saveRate,
            breakoutCount, breakoutRate, relativePerformance, confidence, classification
          ]);
        };

        const categoryMap = {};
        platformPosts.forEach(p => {
          const cat = p.category.toUpperCase();
          if (!categoryMap[cat]) categoryMap[cat] = [];
          categoryMap[cat].push(p);
        });
        Object.keys(categoryMap).forEach(cat => {
          aggregateGroup(categoryMap[cat], 'category', cat);
        });

        const formatMap = {};
        platformPosts.forEach(p => {
          const fmt = p.format.toUpperCase();
          if (!formatMap[fmt]) formatMap[fmt] = [];
          formatMap[fmt].push(p);
        });
        Object.keys(formatMap).forEach(fmt => {
          aggregateGroup(formatMap[fmt], 'format', fmt);
        });

        const timeMap = {};
        platformPosts.forEach(p => {
          const hour = p.posting_hour || '00:00';
          if (!timeMap[hour]) timeMap[hour] = [];
          timeMap[hour].push(p);
        });
        Object.keys(timeMap).forEach(hour => {
          aggregateGroup(timeMap[hour], 'time', hour);
        });
      });
    });

    Logger.log("=== Aggregation Processing Completed Successfully ===");
  }
};

/**
 * Wrapper to run content performance metrics aggregation daily
 */
function runPerformanceAggregator() {
  Logger.log("=== Triggering runPerformanceAggregator wrapper ===");
  try {
    PerformanceAggregator.aggregatePerformanceMetrics();
    Logger.log("✓ Aggregator run completed successfully.");
  } catch (e) {
    Logger.log("✗ Aggregator run failed: " + e.message);
  }
}

/**
 * Register daily trigger at 12:30 IST (07:00 UTC) for runPerformanceAggregator
 */
function setupPerformanceAggregatorTrigger() {
  const functionName = 'runPerformanceAggregator';
  
  // Clean up any duplicate triggers targeting this function to preserve idempotency
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 12:30 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(12)
    .nearMinute(30)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for runPerformanceAggregator at 12:30 IST (07:00 UTC).");
}
