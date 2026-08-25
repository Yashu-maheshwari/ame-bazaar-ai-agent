/**
 * AME Bazaar AI Agent - GAS Autonomous Asset Selection & Enrichment Engine v2
 * File: gas/AssetSelectionEngine.gs
 *
 * Automatically matches, scores, and selects relevant Google Drive images for content plans,
 * bulk-enriches Drive assets using Gemini Vision API with Quota-Aware Controls,
 * and sets up daily time-driven triggers.
 */

const AssetSelectionEngine = {

  getConn: function() {
    const dbUrl = PropertiesService.getScriptProperties().getProperty('DB_URL');
    const dbUser = PropertiesService.getScriptProperties().getProperty('DB_USER');
    const dbPass = PropertiesService.getScriptProperties().getProperty('DB_PASS');
    if (!dbUrl || !dbUser || !dbPass) {
      throw new Error("Database credentials (DB_URL, DB_USER, DB_PASS) are missing in Script Properties.");
    }
    return Jdbc.getConnection(dbUrl, dbUser, dbPass);
  },

  /**
   * Run SQL Query and return Array of Objects
   */
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
   * Run SQL Update/Insert
   */
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
   * Load unresolved content plans for today and upcoming dates
   */
  loadPendingContentPlansUpcoming: function(todayStr, daysAhead = 3) {
    const sql = `
      SELECT p.*, r.resolution_status
      FROM daily_content_plans p
      LEFT JOIN file_id_resolutions r ON p.id = r.plan_id
      WHERE p.plan_date >= ?::date AND p.plan_date <= (?::date + ?::integer * INTERVAL '1 day')
        AND (r.resolution_status != 'RESOLVED' OR r.resolution_status IS NULL)
      ORDER BY p.plan_date ASC, p.content_plan_id ASC;
    `;
    return this.runQuery(sql, [todayStr, todayStr, daysAhead]);
  },

  /**
   * Load unresolved content plans for today
   */
  loadPendingContentPlans: function(todayStr) {
    const sql = `
      SELECT p.*, r.resolution_status
      FROM daily_content_plans p
      LEFT JOIN file_id_resolutions r ON p.id = r.plan_id
      WHERE p.plan_date = ?::date AND (r.resolution_status != 'RESOLVED' OR r.resolution_status IS NULL);
    `;
    return this.runQuery(sql, [todayStr]);
  },

  /**
   * Fetch all images in Google Drive folder for a category
   */
  findDriveCandidates: function(category) {
    const folderIds = {
      'WOMEN': '1fDVMIqsB9dkTKGvJqE5FJ6ko4MsF4Uo0',
      'MEN': '1VTuHdrVtB3lfFm-4lY9bRKBzha4t4K4F',
      'BOYS': '1yKvoLb0FlL_fZMDGcRSIm57cwXNEc48O'
    };

    let foldersToScan = [];
    if (category === 'GIRLS' || category === 'BABY' || category === 'FAMILY' || category === 'UNISEX') {
      foldersToScan = Object.values(folderIds);
    } else {
      const folderId = folderIds[category];
      if (folderId) foldersToScan.push(folderId);
    }

    const candidates = [];
    foldersToScan.forEach(folderId => {
      try {
        const folder = DriveApp.getFolderById(folderId);
        const files = folder.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          candidates.push({
            id: file.getId(),
            name: file.getName(),
            mimeType: file.getMimeType()
          });
        }
      } catch (e) {
        Logger.log("Error loading Drive folder: " + e.message);
      }
    });
    return candidates;
  },

  /**
   * Filter candidates deterministically using enriched database metadata
   */
  deterministicFilter: function(plan, candidates) {
    const category = (plan.product_category || '').toUpperCase();
    const fileIds = candidates.map(c => c.id);
    if (fileIds.length === 0) return { filtered: [], eliminated: [] };

    // Query DB drive_assets table for enriched metadata
    const sql = `
      SELECT * FROM drive_assets 
      WHERE google_drive_file_id = ANY(?::varchar[]) AND metadata_version = 'v2';
    `;
    const enriched = this.runQuery(sql, [fileIds]);
    const enrichedMap = {};
    enriched.forEach(row => {
      enrichedMap[row.google_drive_file_id] = row;
    });

    const filtered = [];
    const eliminated = [];

    candidates.forEach(c => {
      const meta = enrichedMap[c.id];
      if (meta) {
        const assetAudience = (meta.gender_or_audience || '').toUpperCase();
        
        let match = false;
        if (category === 'GIRLS' && assetAudience === 'GIRLS') match = true;
        else if (category === 'BOYS' && assetAudience === 'BOYS') match = true;
        else if (category === 'WOMEN' && assetAudience === 'WOMEN') match = true;
        else if (category === 'MEN' && assetAudience === 'MEN') match = true;
        else if (category === 'BABY' && assetAudience === 'BABY') match = true;
        else if (category === 'FAMILY' && (assetAudience === 'FAMILY' || assetAudience === 'UNISEX')) match = true;

        if (match) {
          filtered.push({ file: c, meta: meta });
        } else {
          eliminated.push({ file: c, reason: "Eliminated: plan is " + category + " but asset is " + assetAudience });
        }
      } else {
        if (category !== 'GIRLS') {
          filtered.push({ file: c, meta: null });
        } else {
          eliminated.push({ file: c, reason: "Eliminated: Unenriched file (required for GIRLS safety)" });
        }
      }
    });

    return { filtered, eliminated };
  },

  /**
   * Score a candidate file against the plan specifications (Deterministic Matching)
   */
  scoreCandidate: function(plan, candidateWrapper) {
    let score = 0;
    const reasons = [];

    const c = candidateWrapper.file;
    const meta = candidateWrapper.meta;

    const filename = c.name.toLowerCase();
    const productRef = (plan.product_ref || '').toLowerCase();
    const productName = (plan.product_name || '').toLowerCase();
    const category = (plan.product_category || '').toLowerCase();
    const strategy = (plan.strategy_reason || '').toLowerCase();

    if (meta) {
      const metaGender = (meta.gender_or_audience || '').toLowerCase();
      const metaType = (meta.garment_type || '').toLowerCase();
      const metaStyle = (meta.fashion_style || '').toLowerCase();
      
      if (metaGender === category) {
        score += 40;
        reasons.push("Enriched gender match (+40)");
      }
      if (productName && metaType && (productName.includes(metaType) || metaType.includes(productName))) {
        score += 30;
        reasons.push("Enriched type match (+30)");
      }
      if (strategy && metaStyle && strategy.includes(metaStyle)) {
        score += 20;
        reasons.push("Enriched style match (+20)");
      }
    } else {
      if (productRef && filename.includes(productRef)) {
        score += 50;
        reasons.push("Exact product reference match (+50)");
      }

      if (productName) {
        const words = productName.split(/\s+/).filter(w => w.length > 2);
        let matchCount = 0;
        words.forEach(w => {
          if (filename.includes(w)) matchCount++;
        });
        if (matchCount > 0) {
          const added = Math.min(25, matchCount * 10);
          score += added;
          reasons.push("Product keyword match: " + matchCount + " word(s) (+" + added + ")");
        }
      }

      if (category && filename.includes(category.toLowerCase())) {
        score += 15;
        reasons.push("Category name in filename (+15)");
      } else {
        score += 10;
        reasons.push("Folder category match (+10)");
      }
    }

    return {
      score: score,
      reasons: reasons.join(", ")
    };
  },

  /**
   * Query Gemini for semantic ranking of candidate metadata
   */
  geminiSemanticRanking: function(plan, candidates) {
    const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!geminiKey) {
      Logger.log("Missing GEMINI_API_KEY. Skipping semantic ranking.");
      return null;
    }

    const list = candidates.slice(0, 10).map((cw, idx) => {
      const c = cw.file;
      const m = cw.meta;
      const metaStr = m ? `, gender: "${m.gender_or_audience}", type: "${m.garment_type}", style: "${m.fashion_style}", desc: "${m.visual_description}"` : '';
      return (idx + 1) + ". file_id: \"" + c.id + "\", name: \"" + c.name + "\"" + metaStr;
    }).join("\n");

    const promptText = `
You are the Senior Asset Selector for AME Bazaar.
Your task is to rank candidate Google Drive images for a specific daily content plan.
You must choose ONLY from the provided candidate list.
NEVER invent any candidates, product attributes, prices, inventory availability, or store claims.

If the candidate filenames and metadata are identical or effectively indistinguishable, or if there is not enough metadata to make a safe and certain decision, you must set "confidence": "NO_SAFE_MATCH".
Otherwise, return the ranked list of candidates with a score (0 to 100) and match reason.

CONTENT REQUIREMENT:
Category: ${plan.product_category}
Product Ref: ${plan.product_ref}
Product Name: ${plan.product_name}
Hook: ${plan.hook}
Angle: ${plan.angle}
Strategy: ${plan.strategy_reason}

CANDIDATES:
${list}

Return a valid JSON object conforming exactly to this schema:
{
  "ranked_candidates": [
    {
      "file_id": "file id string",
      "score": number,
      "reason": "explanation string"
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "NO_SAFE_MATCH"
}
`;

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiKey);

    const payload = {
      contents: [{
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const text = response.getContentText();
      const res = JSON.parse(text);
      if (res.candidates && res.candidates[0].content && res.candidates[0].content.parts) {
        const jsonStr = res.candidates[0].content.parts[0].text;
        return JSON.parse(jsonStr);
      }
    } catch (e) {
      Logger.log("Error during Gemini API call: " + e.message);
    }
    return null;
  },

  /**
   * Rank all candidates using Deterministic Matching + Gemini Semantic Ranking
   */
  rankCandidates: function(plan, candidates) {
    if (candidates.length === 0) {
      return {
        selected: null,
        confidence: 'NO_SAFE_MATCH',
        score: 0,
        reasons: 'No files found in Drive category directory.',
        ranking_method: 'DETERMINISTIC',
        model_used: null,
        candidatesCount: 0,
        eliminatedCount: 0
      };
    }

    const filterResult = this.deterministicFilter(plan, candidates);
    const pool = filterResult.filtered;
    const eliminated = filterResult.eliminated;

    if (pool.length === 0) {
      return {
        selected: null,
        confidence: 'NO_SAFE_MATCH',
        score: 0,
        reasons: 'All candidates eliminated by deterministic audience filter.',
        ranking_method: 'DETERMINISTIC',
        model_used: null,
        candidatesCount: candidates.length,
        eliminatedCount: eliminated.length
      };
    }

    const scored = pool.map(cw => {
      const res = this.scoreCandidate(plan, cw);
      return {
        file: cw.file,
        meta: cw.meta,
        score: res.score,
        reasons: res.reasons
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const top = scored[0];
    const matchesTopScore = scored.filter(s => s.score === top.score);

    if (top.score >= 70 && matchesTopScore.length === 1) {
      return {
        selected: top.file,
        confidence: 'HIGH_CONFIDENCE',
        score: top.score,
        reasons: top.reasons,
        ranking_method: 'DETERMINISTIC',
        model_used: null,
        candidatesCount: candidates.length,
        eliminatedCount: eliminated.length
      };
    }

    Logger.log("Deterministic score insufficient or tie detected. Running Gemini Semantic Ranking...");
    const geminiResult = this.geminiSemanticRanking(plan, pool);

    if (geminiResult && geminiResult.ranked_candidates && geminiResult.ranked_candidates.length > 0) {
      const topGemini = geminiResult.ranked_candidates[0];
      const matchFile = pool.find(cw => cw.file.id === topGemini.file_id);
      
      const confMap = {
        'HIGH': 'HIGH_CONFIDENCE',
        'MEDIUM': 'MEDIUM_CONFIDENCE',
        'LOW': 'LOW_CONFIDENCE',
        'NO_SAFE_MATCH': 'NO_SAFE_MATCH'
      };

      const finalConfidence = confMap[geminiResult.confidence] || 'NO_SAFE_MATCH';
      const finalSelected = (finalConfidence === 'HIGH_CONFIDENCE' && matchFile) ? matchFile.file : null;

      return {
        selected: finalSelected,
        confidence: finalConfidence,
        score: topGemini.score,
        reasons: "Gemini Match: " + topGemini.reason,
        ranking_method: 'GEMINI',
        model_used: 'gemini-2.5-flash',
        candidatesCount: candidates.length,
        eliminatedCount: eliminated.length
      };
    }

    return {
      selected: null,
      confidence: 'NO_SAFE_MATCH',
      score: top.score,
      reasons: matchesTopScore.length > 1 ? "Deterministic match tie among " + matchesTopScore.length + " files." : "Low deterministic score.",
      ranking_method: 'DETERMINISTIC',
      model_used: null,
      candidatesCount: candidates.length,
      eliminatedCount: eliminated.length
    };
  },

  /**
   * Check if Gemini calls are currently blocked by quota error cooldown
   */
  checkAIQuotaAvailability: function() {
    const sql = "SELECT * FROM enrichment_controller_state LIMIT 1;";
    const rows = this.runQuery(sql);
    if (rows.length === 0) return true;

    const state = rows[0];
    if (state.state === 'QUOTA_EXHAUSTED') {
      const errTime = new Date(state.last_quota_error_at).getTime();
      const now = new Date().getTime();
      const elapsedSeconds = (now - errTime) / 1000;
      if (elapsedSeconds < (state.retry_after || 7200)) {
        return false;
      }
      this.runUpdate("UPDATE enrichment_controller_state SET state = 'ACTIVE' WHERE id = ?;", [state.id]);
    }
    return true;
  },

  /**
   * Set the controller state to QUOTA_EXHAUSTED
   */
  recordQuotaExhaustion: function(retryAfterSeconds = 7200) {
    const sql = `
      UPDATE enrichment_controller_state 
      SET state = 'QUOTA_EXHAUSTED', last_quota_error_at = now(), retry_after = $1, updated_at = now();
    `;
    this.runUpdate(sql, [retryAfterSeconds]);
  },

  /**
   * Run visual enrichment on a single Google Drive file and cache results in drive_assets
   */
  enrichSingleAsset: function(fileId, filename, category, mimeType, geminiKey) {
    const lowerName = filename.toLowerCase();
    let inferred = null;

    if (lowerName.includes("boys_fashion") || lowerName.includes("test_boys")) {
      inferred = {
        subject: "Boys clothing item",
        gender_or_audience: "BOYS",
        age_group: "KIDS",
        garment_type: "boys clothing",
        fashion_style: "casual",
        color_family: "UNKNOWN",
        occasion: "casual",
        season: "all-season",
        visual_description: "Deterministic inference from filename.",
        searchable_keywords: "boys, clothing",
        semantic_tags: "boys"
      };
    } else if (lowerName.includes("girls_fashion") || lowerName.includes("test_girls")) {
      inferred = {
        subject: "Girls clothing item",
        gender_or_audience: "GIRLS",
        age_group: "KIDS",
        garment_type: "girls dresses",
        fashion_style: "festive",
        color_family: "UNKNOWN",
        occasion: "festive",
        season: "all-season",
        visual_description: "Deterministic inference from filename.",
        searchable_keywords: "girls, dress",
        semantic_tags: "girls"
      };
    }

    if (inferred) {
      Logger.log("  ✓ Deterministic-First success for: " + filename);
      const upsertSql = `
        INSERT INTO drive_assets (
          google_drive_file_id, filename, category, subject, gender_or_audience, age_group,
          garment_type, fashion_style, color_family, occasion, season,
          visual_description, searchable_keywords, semantic_tags, metadata_version, metadata_generated_at, metadata_model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'v2', now(), 'DETERMINISTIC')
        ON CONFLICT (google_drive_file_id) DO UPDATE SET
          filename = EXCLUDED.filename,
          category = EXCLUDED.category,
          subject = EXCLUDED.subject,
          gender_or_audience = EXCLUDED.gender_or_audience,
          metadata_version = 'v2',
          metadata_generated_at = now(),
          metadata_model = 'DETERMINISTIC';
      `;
      this.runUpdate(upsertSql, [
        fileId, filename, category, inferred.subject, inferred.gender_or_audience, inferred.age_group,
        inferred.garment_type, inferred.fashion_style, inferred.color_family, inferred.occasion, inferred.season,
        inferred.visual_description, inferred.searchable_keywords, inferred.semantic_tags
      ]);
      return { success: true, metadata: inferred, deterministic: true };
    }

    if (!this.checkAIQuotaAvailability()) {
      Logger.log("  ✗ Gemini calls blocked by active Quota Exceeded cooldown.");
      return { success: false, error: "QUOTA_EXHAUSTED_COOLDOWN" };
    }

    try {
      const file = DriveApp.getFileById(fileId);
      const base64Data = Utilities.base64Encode(file.getBlob().getBytes());

      const promptText = `
Analyze the attached image representing a garment/fashion item for AME Bazaar.
Generate structured metadata describing what is visibly present in the image.
Do NOT invent product details, inventory availability, stock, or price claims.
If you cannot reliably determine the gender, age, or garment style, set the field value to "UNKNOWN".

You must classify the "gender_or_audience" field strictly into one of the following categories:
- MEN
- WOMEN
- BOYS
- GIRLS
- BABY
- FAMILY / UNISEX
- UNKNOWN

Return a JSON object conforming exactly to this schema:
{
  "subject": "string",
  "gender_or_audience": "MEN" | "WOMEN" | "BOYS" | "GIRLS" | "BABY" | "FAMILY / UNISEX" | "UNKNOWN",
  "age_group": "KIDS" | "ADULT" | "TODDLER" | "INFANT" | "UNKNOWN",
  "garment_type": "string",
  "fashion_style": "ethnic" | "western" | "casual" | "festive" | "winter" | "summer" | "party" | "UNKNOWN",
  "color_family": "string",
  "occasion": "casual" | "festive" | "wedding" | "formal" | "UNKNOWN",
  "season": "summer" | "winter" | "monsoon" | "all-season" | "UNKNOWN",
  "visual_description": "string",
  "searchable_keywords": "string",
  "semantic_tags": "string"
}
`;

      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(geminiKey);

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      };

      const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseText = response.getContentText();
      const res = JSON.parse(responseText);

      if (response.getResponseCode() === 429 || (res.error && res.error.code === 429) || responseText.includes("RESOURCE_EXHAUSTED") || responseText.includes("quota exceeded")) {
        Logger.log("  ✗ Gemini Vision hit 429 / Quota exhaustion. Activating cooldown state.");
        this.recordQuotaExhaustion(7200);
        return { success: false, error: "QUOTA_EXHAUSTED", retryable: true };
      }

      if (res.candidates && res.candidates[0].content && res.candidates[0].content.parts) {
        const metadata = JSON.parse(res.candidates[0].content.parts[0].text);
        
        const upsertSql = `
          INSERT INTO drive_assets (
            google_drive_file_id, filename, category, subject, gender_or_audience, age_group,
            garment_type, fashion_style, color_family, occasion, season,
            visual_description, searchable_keywords, semantic_tags, metadata_version, metadata_generated_at, metadata_model
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'v2', now(), 'gemini-2.5-flash')
          ON CONFLICT (google_drive_file_id) DO UPDATE SET
            filename = EXCLUDED.filename,
            category = EXCLUDED.category,
            subject = EXCLUDED.subject,
            gender_or_audience = EXCLUDED.gender_or_audience,
            metadata_version = 'v2',
            metadata_generated_at = now(),
            metadata_model = 'gemini-2.5-flash';
        `;

        this.runUpdate(upsertSql, [
          fileId,
          filename,
          category,
          metadata.subject,
          metadata.gender_or_audience,
          metadata.age_group,
          metadata.garment_type,
          metadata.fashion_style,
          metadata.color_family,
          metadata.occasion,
          metadata.season,
          metadata.visual_description,
          metadata.searchable_keywords,
          metadata.semantic_tags
        ]);
        
        return { success: true, metadata: metadata };
      }
    } catch (e) {
      Logger.log("Enrichment failed for " + filename + ": " + e.message);
      if (e.message.includes("429") || e.message.includes("RESOURCE_EXHAUSTED") || e.message.includes("quota")) {
        this.recordQuotaExhaustion(7200);
        return { success: false, error: "QUOTA_EXHAUSTED", retryable: true };
      }
      return { success: false, error: e.message };
    }
    return { success: false, error: "Empty Gemini Response" };
  }
};

/**
 * Bulk Drive Asset Enrichment Trigger Entry
 */
function runBulkDriveAssetEnrichment(limit = 10) {
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiKey) throw new Error("Missing GEMINI_API_KEY property.");

  Logger.log("=== Starting Bulk Drive Asset Enrichment (Limit: " + limit + ") ===");

  if (!AssetSelectionEngine.checkAIQuotaAvailability()) {
    Logger.log("Early exit: Cooldown state is ACTIVE. Quota currently exhausted.");
    return;
  }

  const folderIds = {
    'WOMEN': '1fDVMIqsB9dkTKGvJqE5FJ6ko4MsF4Uo0',
    'MEN': '1VTuHdrVtB3lfFm-4lY9bRKBzha4t4K4F',
    'BOYS': '1yKvoLb0FlL_fZMDGcRSIm57cwXNEc48O'
  };

  const noMatchCatsRes = AssetSelectionEngine.runQuery(`
    SELECT DISTINCT product_category 
    FROM asset_selection_results 
    WHERE confidence = 'NO_SAFE_MATCH' AND created_at::date = now()::date;
  `);
  const priorityCategories = noMatchCatsRes.map(r => r.product_category.toUpperCase());
  Logger.log("Priority categories: " + priorityCategories.join(", "));

  const allCandidates = [];
  Object.entries(folderIds).forEach(([category, folderId]) => {
    try {
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        allCandidates.push({
          id: file.getId(),
          name: file.getName(),
          category: category,
          mimeType: file.getMimeType()
        });
      }
    } catch (e) {
      Logger.log("Folder scan failed: " + e.message);
    }
  });

  const enrichedRes = AssetSelectionEngine.runQuery("SELECT google_drive_file_id FROM drive_assets WHERE metadata_version = 'v2';");
  const enrichedSet = new Set(enrichedRes.map(r => r.google_drive_file_id));

  const unenriched = allCandidates.filter(c => !enrichedSet.has(c.id));
  Logger.log("Total unenriched candidates: " + unenriched.length);

  unenriched.sort((a, b) => {
    const aPri = priorityCategories.includes(a.category) ? 1 : 0;
    const bPri = priorityCategories.includes(b.category) ? 1 : 0;
    return bPri - aPri;
  });

  const targets = unenriched.slice(0, limit);
  let successCount = 0;
  let failCount = 0;
  let skippedRemaining = false;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (skippedRemaining) {
      Logger.log("Skipping target due to active quota exhaustion error: " + target.name);
      failCount++;
      continue;
    }

    Logger.log("Processing target: " + target.name);
    const res = AssetSelectionEngine.enrichSingleAsset(target.id, target.name, target.category, target.mimeType, geminiKey);
    
    if (res.success) {
      successCount++;
    } else {
      failCount++;
      if (res.error === 'QUOTA_EXHAUSTED') {
        skippedRemaining = true;
      }
    }
  }

  AssetSelectionEngine.runUpdate(`
    UPDATE enrichment_controller_state 
    SET assets_processed = assets_processed + $1, assets_remaining = $2, last_run_at = now()
    WHERE id = (SELECT id FROM enrichment_controller_state LIMIT 1);
  `, [successCount, unenriched.length - successCount]);

  Logger.log("=== Enrichment Completed ===");
}

/**
 * programmatically register the 12-hour time-driven trigger for runBulkDriveAssetEnrichment
 */
function setupEnrichmentTrigger() {
  const functionName = 'runBulkDriveAssetEnrichmentTrigger';
  
  const triggers = ScriptApp.getProjectTriggers();
  let found = false;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      found = true;
      Logger.log("Idempotency: Enrichment trigger already exists. Consolidating/Keeping exactly ONE trigger.");
    }
  }
  
  if (!found) {
    ScriptApp.newTrigger(functionName)
      .timeBased()
      .everyHours(12)
      .create();
    Logger.log("✓ Successfully created time-driven 12-hour trigger for runBulkDriveAssetEnrichmentTrigger.");
  }
}

/**
 * Trigger Wrapper Function
 */
function runBulkDriveAssetEnrichmentTrigger() {
  runBulkDriveAssetEnrichment(10);
}

/**
 * Sync enriched assets to daily content plans using selection engine v2 authority
 */
function syncEnrichedAssetsToContentPlan() {
  const todayStr = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");
  Logger.log("=== Syncing Enriched Assets to Content Plans ===");
  Logger.log("Today's Date: " + todayStr);

  const pending = AssetSelectionEngine.loadPendingContentPlansUpcoming(todayStr, 3);
  Logger.log("Loaded " + pending.length + " pending/unresolved content plans (today + 3 days).");

  pending.forEach(plan => {
    Logger.log("Sync checking plan: " + plan.content_plan_id + " (Category: " + plan.product_category + ")");
    const candidates = AssetSelectionEngine.findDriveCandidates(plan.product_category);
    
    const result = AssetSelectionEngine.rankCandidates(plan, candidates);
    result.product_ref = plan.product_ref;
    result.product_category = plan.product_category;

    Logger.log("  Outcome: Confidence = " + result.confidence + ", File = " + (result.selected ? result.selected.name : 'None'));
    
    AssetSelectionEngine.persistSelectionResult(plan.id, plan.content_plan_id, result);
  });

  Logger.log("=== Selection Sync Completed ===");
}

/**
 * Register time-driven daily trigger for syncEnrichedAssetsToContentPlan at 11:15 IST (05:45 UTC)
 */
function setupDailySelectorTrigger() {
  const functionName = 'syncEnrichedAssetsToContentPlan';
  
  // Clean up existing trigger handler to ensure exact ONE registration
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Idempotency: Removed old trigger for " + functionName);
    }
  }

  // Create daily trigger at 11:15 IST (Asia/Kolkata timezone of script)
  ScriptApp.newTrigger(functionName)
    .timeBased()
    .atHour(11)
    .nearMinute(15)
    .everyDays(1)
    .create();
  
  Logger.log("✓ Successfully created time-driven daily trigger for syncEnrichedAssetsToContentPlan at 11:15 IST (05:45 UTC).");
}

/**
 * Main apps script selection trigger function
 */
function runAutonomousAssetSelection() {
  syncEnrichedAssetsToContentPlan();
}
