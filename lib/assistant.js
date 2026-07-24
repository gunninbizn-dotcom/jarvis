/**
 * lib/assistant.js
 *
 * DEPRECATED — This module is no longer used.
 *
 * The Gemini conversation pipeline has been moved to lib/gemini.js,
 * which provides proper system_instruction, conversation history,
 * and streaming support via the Google Gemini API.
 *
 * This file is kept for backward compatibility but should not be imported.
 * It will be removed in a future cleanup pass.
 */

export const DEPRECATED = true;
export { SYSTEM_PROMPT } from './gemini';
export { normalizeHistory, buildRequestBody, createGeminiReply, createGeminiStreamReply } from './gemini';
