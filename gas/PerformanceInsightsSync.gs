/**
 * AME Bazaar AI Agent - GAS Performance Insights Sync Component
 * File: gas/PerformanceInsightsSync.gs
 *
 * Automatically fetches and caches organic performance metrics for published social posts.
 */

const PerformanceInsightsSync = {

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
   * Load published posts from platform_publish_results
   */
  loadPublishedPosts: function(limit = 10) {
    const sql = `
      SELECT platform_post_id, platform, published_at 
      FROM platform_publish_results 
      WHERE status = 'SUCCESS' AND platform_post_id IS NOT NULL
      ORDER BY published_at DESC LIMIT ?::integer;
    `;
    return this.runQuery(sql, [limit]);
  },

  /**
   * Retrieve Instagram metrics from Meta Graph API
   */
  fetchInstagramMetrics: function(postId, token) {
    const url = "https://graph.facebook.com/v19.0/" + encodeURIComponent(postId) + 
                "?fields=like_count,comments_count&access_token=" + encodeURIComponent(token);
    
    const options = { method: "get", muteHttpExceptions: true };
    const response = UrlFetchApp.fetch(url, options);
    const respCode = response.getResponseCode();
    const respText = response.getContentText();
    const data = JSON.parse(respText);

    if (respCode === 429 || respText.includes("RESOURCE_EXHAUSTED") || respText.includes("quota exceeded")) {
      return { success: false, rateLimit: true, error: "Rate Limit Exceeded" };
    }

    if (respCode !== 200) {
      return { success: false, error: data.error ? data.error.message : "Unknown API Error" };
    }

    let reach = null;
    let impressions = null;
    let shares = null;
    let saves = null;
    let totalInteractions = null;
    
    try {
      const insightsUrl = "https://graph.facebook.com/v19.0/" + encodeURIComponent(postId) + 
                          "/insights?metric=reach,impressions,shares,saves,total_interactions&access_token=" + encodeURIComponent(token);
      const res = UrlFetchApp.fetch(insightsUrl, options);
      const resData = JSON.parse(res.getContentText());
      if (resData.data) {
        resData.data.forEach(m => {
          const val = m.values && m.values[0] ? m.values[0].value : null;
          if (m.name === 'reach') reach = val;
          else if (m.name === 'impressions') impressions = val;
          else if (m.name === 'shares') shares = val;
          else if (m.name === 'saves') saves = val;
          else if (m.name === 'total_interactions') totalInteractions = val;
        });
      }
    } catch (e) {
      Logger.log("Insights not supported for post " + postId + ": " + e.message);
    }

    return {
      success: true,
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      reach: reach,
      impressions: impressions,
      shares: shares,
      saves: saves,
      total_interactions: totalInteractions
    };
  },

  /**
   * Retrieve Facebook Page post metrics from Meta Graph API
   */
  fetchFacebookMetrics: function(postId, token) {
    const url = "https://graph.facebook.com/v19.0/" + encodeURIComponent(postId) + 
                "?fields=likes.summary(true),comments.summary(true),shares&access_token=" + encodeURIComponent(token);
    
    const options = { method: "get", muteHttpExceptions: true };
    const response = UrlFetchApp.fetch(url, options);
    const respCode = response.getResponseCode();
    const respText = response.getContentText();
    const data = JSON.parse(respText);

    if (respCode === 429 || respText.includes("RESOURCE_EXHAUSTED") || respText.includes("quota exceeded")) {
      return { success: false, rateLimit: true, error: "Rate Limit Exceeded" };
    }

    if (respCode !== 200) {
      return { success: false, error: data.error ? data.error.message : "Unknown API Error" };
    }

    const likesCount = (data.likes && data.likes.summary) ? data.likes.summary.total_count : 0;
    const commentsCount = (data.comments && data.comments.summary) ? data.comments.summary.total_count : 0;
    const sharesCount = (data.shares && data.shares.count) ? data.shares.count : 0;

    let reach = null;
    let impressions = null;
    let clicks = null;

    try {
      const insightsUrl = "https://graph.facebook.com/v19.0/" + encodeURIComponent(postId) + 
                          "/insights?metric=post_impressions_unique,post_impressions,post_clicks&access_token=" + encodeURIComponent(token);
      const res = UrlFetchApp.fetch(insightsUrl, options);
      const resData = JSON.parse(res.getContentText());
      if (resData.data) {
        resData.data.forEach(m => {
          const val = m.values && m.values[0] ? m.values[0].value : null;
          if (m.name === 'post_impressions_unique') reach = val;
          else if (m.name === 'post_impressions') impressions = val;
          else if (m.name === 'post_clicks') clicks = val;
        });
      }
    } catch(e) {
      Logger.log("Insights not supported for post " + postId + ": " + e.message);
    }

    return {
      success: true,
      likes: likesCount,
      comments: commentsCount,
      shares: sharesCount,
      reach: reach,
      impressions: impressions,
      facebook_clicks: clicks
    };
  },

  /**
   * Main sync function execution
   */
  syncPublishedPostInsights: function() {
    Logger.log("=== Starting Automated Performance Insights Sync ===");
    
    const token = PropertiesService.getScriptProperties().getProperty('META_PAGE_ACCESS_TOKEN') || 
                  PropertiesService.getScriptProperties().getProperty('META_ACCESS_TOKEN');
    if (!token) {
      Logger.log("Missing Meta Access Token Script Property.");
      return;
    }

    const posts = this.loadPublishedPosts(10);
    Logger.log("Found " + posts.length + " published posts to check.");

    let syncedCount = 0;
    let failedCount = 0;
    let rateLimited = false;

    posts.forEach(post => {
      if (rateLimited) return;

      const dupCheckSql = `
        SELECT id FROM post_performance_insights 
        WHERE platform_post_id = ? AND collected_at::date = now()::date;
      `;
      const dups = this.runQuery(dupCheckSql, [post.platform_post_id]);
      if (dups.length > 0) {
        Logger.log("  Idempotency skip: post " + post.platform_post_id + " already synced today.");
        return;
      }

      Logger.log("Syncing post ID: " + post.platform_post_id + " (" + post.platform + ")");
      let metrics = null;

      const isInstagram = post.platform === 'INSTAGRAM_FEED' || post.platform === 'INSTAGRAM_STORY';
      
      if (isInstagram) {
        metrics = this.fetchInstagramMetrics(post.platform_post_id, token);
      } else {
        metrics = this.fetchFacebookMetrics(post.platform_post_id, token);
      }

      if (!metrics.success) {
        failedCount++;
        Logger.log("  ✗ Failed to fetch metrics: " + metrics.error);
        if (metrics.rateLimit) {
          rateLimited = true;
        }
        
        const errSql = `
          INSERT INTO post_performance_insights (
            platform_post_id, platform, published_at, collection_status, error_message, collected_at, api_version
          ) VALUES ($1, $2, $3, 'FAILED', $4, now(), 'v19.0');
        `;
        this.runUpdate(errSql, [post.platform_post_id, post.platform, post.published_at, metrics.error]);
        return;
      }

      const insertSql = `
        INSERT INTO post_performance_insights (
          platform_post_id, platform, published_at, reach, impressions, likes, comments, shares, saves, 
          facebook_clicks, total_interactions, collection_status, collected_at, api_version
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SUCCESS', now(), 'v19.0');
      `;
      
      this.runUpdate(insertSql, [
        post.platform_post_id,
        post.platform,
        post.published_at,
        metrics.reach,
        metrics.impressions,
        metrics.likes,
        metrics.comments,
        metrics.shares,
        metrics.saves,
        metrics.facebook_clicks,
        metrics.total_interactions
      ]);

      syncedCount++;
      Logger.log("  ✓ Successfully synced metrics: likes=" + metrics.likes + ", comments=" + metrics.comments);
    });

    Logger.log("=== Performance Insights Sync Completed ===");
  }
};

/**
 * Register daily trigger at 12:15 IST (06:45 UTC) for syncPublishedPostInsights
 */
function setupDailyPerformanceInsightsTrigger() {
  const functionName = 'syncPublishedPostInsights';
  
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed duplicate trigger config for " + functionName);
    }
  }

  // Create daily trigger at 12:15 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(12)
    .nearMinute(15)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created daily trigger for syncPublishedPostInsights at 12:15 IST (06:45 UTC).");
}
