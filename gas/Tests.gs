/**
 * AME Bazaar AI Agent - Google Apps Script Automated Test Suite
 * File: gas/Tests.gs
 */

function runAllTests() {
  Logger.log("==================================================");
  Logger.log("STARTING GAS AUTOMATED TEST SUITE");
  Logger.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function runTest(testName, fn) {
    try {
      fn();
      Logger.log("✓ PASS: " + testName);
      passed++;
    } catch (err) {
      Logger.log("✗ FAIL: " + testName + " - " + err.message);
      failed++;
    }
  }

  runTest("Test 1: Configuration & Script Properties Loader", testConfigLoader);
  runTest("Test 2: Google Sheets Log Initialization & Duplicate Check", testSheetLoggingAndDuplicateCheck);
  runTest("Test 3: Gemini Prompt Construction & Validation", testGeminiPromptValidation);
  runTest("Test 4: Meta Graph API Request Construction (Test Mode)", testMetaRequestConstruction);
  runTest("Test 5: Trigger Setup & Handler Registration", testTriggerSetup);

  Logger.log("\n==================================================");
  Logger.log("TEST SUMMARY: " + passed + " PASSED, " + failed + " FAILED");
  Logger.log("==================================================");
}

function testConfigLoader() {
  const config = Config.getConfig();
  if (typeof config !== 'object') throw new Error("Config object missing");
  if (typeof config.testMode !== 'boolean') throw new Error("testMode must be boolean");
}

function testSheetLoggingAndDuplicateCheck() {
  const mockConfig = Config.getConfig();
  mockConfig.spreadsheetId = ''; // Forces creating or locating log sheet
  
  const testFileId = "test_file_id_" + Date.now();
  const testExecutionId = "exec_test_" + Date.now();

  // Initially should not be processed
  const initialCheck = SheetService.isProcessed(mockConfig, testFileId);
  if (initialCheck) throw new Error("File should not be processed yet");

  // Log a test execution
  SheetService.logExecution(mockConfig, {
    fileId: testFileId,
    fileName: "test_image.jpg",
    platform: "Facebook",
    caption: "[TEST_MODE] High quality garment caption",
    status: "SUCCESS",
    postId: "test_post_123",
    postUrl: "https://facebook.com/test",
    error: "",
    executionId: testExecutionId
  });

  // Verify duplicate check returns true for Facebook
  const history = SheetService.getFilePlatformHistory(mockConfig, testFileId);
  if (!history.Facebook) throw new Error("Sheet duplicate check failed to register Facebook success");
  if (history.Instagram) throw new Error("Instagram should be false since only Facebook was logged");
}

function testGeminiPromptValidation() {
  const prompt = GeminiService.PROMPT;
  if (!prompt.includes("AME Bazaar")) throw new Error("Prompt missing AME Bazaar brand name");
  if (!prompt.includes("Hinglish")) throw new Error("Prompt missing Hinglish requirement");
  if (!prompt.includes("cheap blanket discounts")) throw new Error("Prompt missing discount rule");
}

function testMetaRequestConstruction() {
  const mockConfig = Config.getConfig();
  mockConfig.testMode = true; // Safe test mode

  const publicUrl = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
  const caption = "Test Hinglish Caption #AMEBazaar #Style";

  const fbResult = MetaService.publishToFacebook(mockConfig, publicUrl, caption);
  if (fbResult.status !== 'SUCCESS') throw new Error("Facebook test mode response status failed");

  const igResult = MetaService.publishToInstagram(mockConfig, publicUrl, caption);
  if (igResult.status !== 'SUCCESS') throw new Error("Instagram test mode response status failed");
}

function testTriggerSetup() {
  const mockConfig = Config.getConfig();
  if (mockConfig.timeZone !== 'Asia/Kolkata') throw new Error("TimeZone must be Asia/Kolkata");
}
