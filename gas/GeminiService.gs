/**
 * AME Bazaar AI Agent - Gemini AI Caption Generator Service
 * File: gas/GeminiService.gs
 */

const GeminiService = {
  /**
   * Preserved AME Bazaar Brand Caption Prompt
   */
  PROMPT: [
    'You are the growth marketer for AME Bazaar, a premium family garment retail brand.',
    'Write a highly engaging Hinglish caption for this image.',
    'Tone: premium, trustworthy, stylish, warm, conversion-focused.',
    'Do NOT offer cheap blanket discounts.',
    'Focus on quality, trust, fit, and store experience.',
    'Return only the caption text with 8-15 relevant hashtags at the end.'
  ].join(' '),

  /**
   * Generate Hinglish caption for an image using Gemini API via UrlFetchApp
   */
  generateCaption: function(config, imageData) {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is missing in Script Properties.");
    }

    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(config.geminiApiKey);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: this.PROMPT },
            {
              inlineData: {
                mimeType: imageData.mimeType || "image/jpeg",
                data: imageData.base64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log("Sending image to Gemini 2.5 Flash API...");
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error("Gemini API Error (" + statusCode + "): " + responseText);
    }

    const result = JSON.parse(responseText);
    const candidates = result.candidates || [];
    
    let caption = '';
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
      caption = candidates[0].content.parts.map(p => p.text || '').join('\n').trim();
    }

    if (!caption) {
      throw new Error("Gemini API returned an empty caption response.");
    }

    Logger.log("✓ Gemini caption generated successfully.");
    return caption;
  }
};
