/**
 * AME Bazaar AI Agent - Meta Graph API Posting Service (Instagram & Facebook)
 * File: gas/MetaService.gs
 */

const MetaService = {
  GRAPH_API_VERSION: 'v25.0',

  /**
   * Publish Photo to Instagram Feed
   */
  publishToInstagram: function(config, publicImageUrl, caption) {
    if (config.testMode) {
      Logger.log("ℹ [TEST_MODE] Bypassing real Instagram Graph API call.");
      return {
        status: 'SUCCESS',
        postId: 'TEST_IG_CONTAINER_' + Date.now(),
        postUrl: 'https://instagram.com/p/TEST_MODE_ONLY',
        testMode: true
      };
    }

    if (!config.metaAccessToken || !config.instagramAccountId) {
      throw new Error("META_PAGE_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID is missing in Script Properties.");
    }

    Logger.log("Creating Instagram Media Container...");
    const createUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.instagramAccountId) + "/media";
    const createPayload = {
      image_url: publicImageUrl,
      caption: caption,
      access_token: config.metaAccessToken
    };

    const createOptions = {
      method: "post",
      payload: createPayload,
      muteHttpExceptions: true
    };

    const createRes = UrlFetchApp.fetch(createUrl, createOptions);
    const createCode = createRes.getResponseCode();
    const createBody = createRes.getContentText();

    if (createCode < 200 || createCode >= 300) {
      throw new Error("Instagram Container Creation Failed (" + createCode + "): " + createBody);
    }

    const createData = JSON.parse(createBody);
    const creationId = createData.id || createData.creation_id || createData.media_id;

    if (!creationId) {
      throw new Error("Instagram Container Creation returned no valid creation_id.");
    }

    // Small pause for Meta container processing
    Utilities.sleep(3000);

    Logger.log("Publishing Instagram Media Container ID: " + creationId + "...");
    const publishUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.instagramAccountId) + "/media_publish";
    const publishPayload = {
      creation_id: creationId,
      access_token: config.metaAccessToken
    };

    const publishOptions = {
      method: "post",
      payload: publishPayload,
      muteHttpExceptions: true
    };

    const publishRes = UrlFetchApp.fetch(publishUrl, publishOptions);
    const publishCode = publishRes.getResponseCode();
    const publishBody = publishRes.getContentText();

    if (publishCode < 200 || publishCode >= 300) {
      throw new Error("Instagram Media Publish Failed (" + publishCode + "): " + publishBody);
    }

    const publishData = JSON.parse(publishBody);
    const postId = publishData.id || creationId;
    const postUrl = "https://www.instagram.com/";

    Logger.log("✓ Published successfully to Instagram. Post ID: " + postId);
    return {
      status: 'SUCCESS',
      postId: postId,
      postUrl: postUrl
    };
  },

  /**
   * Publish Photo to Facebook Page
   */
  publishToFacebook: function(config, publicImageUrl, caption) {
    if (config.testMode) {
      Logger.log("ℹ [TEST_MODE] Bypassing real Facebook Graph API call.");
      return {
        status: 'SUCCESS',
        postId: 'TEST_FB_POST_' + Date.now(),
        postUrl: 'https://facebook.com/test_page/posts/TEST_MODE_ONLY',
        testMode: true
      };
    }

    if (!config.metaAccessToken || !config.metaPageId) {
      throw new Error("META_PAGE_ACCESS_TOKEN or META_PAGE_ID is missing in Script Properties.");
    }

    Logger.log("Publishing Photo to Facebook Page ID: " + config.metaPageId + "...");
    const fbUrl = "https://graph.facebook.com/" + this.GRAPH_API_VERSION + "/" + encodeURIComponent(config.metaPageId) + "/photos";
    const fbPayload = {
      url: publicImageUrl,
      caption: caption,
      published: true,
      access_token: config.metaAccessToken
    };

    const fbOptions = {
      method: "post",
      payload: fbPayload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(fbUrl, fbOptions);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error("Facebook Page Photo Post Failed (" + statusCode + "): " + responseText);
    }

    const data = JSON.parse(responseText);
    const postId = data.post_id || data.id;
    const postUrl = "https://facebook.com/" + config.metaPageId;

    Logger.log("✓ Published successfully to Facebook Page. Post ID: " + postId);
    return {
      status: 'SUCCESS',
      postId: postId,
      postUrl: postUrl
    };
  }
};
