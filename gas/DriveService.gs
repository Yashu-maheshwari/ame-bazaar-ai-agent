/**
 * AME Bazaar AI Agent - Google Drive File Management Service
 * File: gas/DriveService.gs
 */

const DriveService = {
  /**
   * List unprocessed image files in the input folder
   */
  getUnprocessedImages: function(config) {
    if (!config.inputFolderId) {
      throw new Error("INPUT_FOLDER_ID is missing in Script Properties.");
    }

    const folder = DriveApp.getFolderById(config.inputFolderId);
    const files = folder.getFiles();
    const unprocessed = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      if (mimeType.indexOf('image/') !== -1 || mimeType === 'application/octet-stream') {
        const fileId = file.getId();
        
        // Verify file is not already logged as processed in Google Sheets
        const alreadyProcessed = SheetService.isProcessed(config, fileId);
        if (!alreadyProcessed) {
          unprocessed.push({
            id: fileId,
            name: file.getName(),
            mimeType: mimeType === 'application/octet-stream' ? 'image/jpeg' : mimeType,
            fileObj: file
          });
        }
      }

      if (unprocessed.length >= config.maxFilesPerRun) {
        break;
      }
    }

    return unprocessed;
  },

  /**
   * Get image blob and base64 string for Gemini API
   */
  getImageData: function(fileObj) {
    const blob = fileObj.getBlob();
    const bytes = blob.getBytes();
    const base64 = Utilities.base64Encode(bytes);
    const mimeType = blob.getContentType() || 'image/jpeg';
    return { mimeType, base64, blob };
  },

  /**
   * Move a file from input folder to target folder (Posted or Error)
   */
  moveFile: function(fileId, targetFolderId) {
    if (!fileId || !targetFolderId) return;
    try {
      const file = DriveApp.getFileById(fileId);
      const targetFolder = DriveApp.getFolderById(targetFolderId);
      file.moveTo(targetFolder);
      Logger.log("✓ Moved file '" + file.getName() + "' (ID: " + fileId + ") to folder " + targetFolderId);
    } catch (err) {
      Logger.log("✗ Error moving file " + fileId + ": " + err.message);
    }
  }
};
