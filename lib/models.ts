// Gemini model IDs available for use in this app
export const GeminiModel = {
  // Best for complex reasoning, multimodal, agentic tasks — main model
  PRO_31: 'gemini-3.1-pro-preview',
  // Fastest + cheapest for high-volume/simple tasks
  FLASH_LITE_31: 'gemini-3.1-flash-lite-preview',
  // Fast + smart, good balance for most tasks
  FLASH_25: 'gemini-2.5-flash',
  // State-of-the-art reasoning and coding
  PRO_25: 'gemini-2.5-pro',
} as const;

export type GeminiModelId = (typeof GeminiModel)[keyof typeof GeminiModel];

// Defaults per use case
export const MODEL_ANALYZE   = GeminiModel.PRO_31;        // video form analysis
export const MODEL_CHAT      = GeminiModel.PRO_31;        // AI coach chat
export const MODEL_PARSE     = GeminiModel.FLASH_LITE_31; // parse training routine text
export const MODEL_VERIFY    = GeminiModel.FLASH_25;      // quick verification calls
export const MODEL_EVOLVE    = GeminiModel.PRO_31;        // training evolution analysis
