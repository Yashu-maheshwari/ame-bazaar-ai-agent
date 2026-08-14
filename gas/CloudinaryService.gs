/**
 * AME Bazaar AI Agent - Public Image URL Hosting Service (Cloudinary & Drive Proxy)
 * File: gas/CloudinaryService.gs
 */

const CloudinaryService = {
  /**
   * Upload Google Drive image blob to Cloudinary for a publicly accessible HTTPS URL required by Instagram Graph API
   */
  getPublicImageUrl: function(config, fileObj, imageData) {
    // 1. Try Cloudinary Unsigned Upload if configured
    if (config.cloudinaryCloudName && config.cloudinaryUploadPreset) {
      try {
        Logger.log("Uploading image to Cloudinary for Instagram public URL...");
        const url = "https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudinaryCloudName) + "/image/upload";
        
        const payload = {
          file: "data:" + (imageData.mimeType || "image/jpeg") + ";base64," + imageData.base64,
          upload_preset: config.cloudinaryUploadPreset,
          folder: "ame-bazaar/raw"
        };

        const options = {
          method: "post",
          payload: payload,
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (statusCode >= 200 && statusCode < 300) {
          const data = JSON.parse(responseText);
          if (data.secure_url) {
            Logger.log("✓ Cloudinary public image URL generated: " + data.secure_url);
            return data.secure_url;
          }
        }
        Logger.log("✗ Cloudinary upload warning (" + statusCode + "): " + responseText);
      } catch (err) {
        Logger.log("✗ Cloudinary upload error: " + err.message);
      }
    }

    // 2. Fallback: Google Drive Direct Public Access Link
    try {
      fileObj.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const drivePublicUrl = "https://lh3.googleusercontent.com/d/" + fileObj.getId();
      Logger.log("ℹ Using Google Drive public image link fallback: " + drivePublicUrl);
      return drivePublicUrl;
    } catch (err) {
      Logger.log("✗ Google Drive public link fallback failed: " + err.message);
      throw new Error("Failed to generate a publicly accessible HTTPS image URL for Instagram Graph API. Please configure CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.");
    }
  }
};
