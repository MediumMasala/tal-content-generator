/**
 * Mastra Configuration
 *
 * This file exports all tools, workflows, and configuration
 * for the Tal Content Engine.
 */

// Tools
export { linkedinExtractorTool, extractLinkedIn } from "./tools/linkedin-extractor";
export { personalityBuilderTool, buildPersonality } from "./tools/personality-builder";
export { contentGeneratorTool, generateContent } from "./tools/content-generator";

// Legacy tools (kept for backwards compatibility)
export { promptEnhancerTool, enhancePrompt } from "./tools/prompt_enhancer";
export { outputDispatcherTool, dispatchOutput } from "./tools/output_dispatcher";
export { generateCaption } from "./tools/caption_generator";

// Workflows
export {
  contentGenerationWorkflow,
  executeContentGeneration,
  type ContentGenerationInput,
  type ContentGenerationOutput,
} from "./workflows/content-generation";

// Legacy flow
export { executeFlow, flowMetadata } from "./flow";

// Storage utilities
export * from "./storage/local-storage";

// Context
export { TAL_CONTEXT, PERSONALITY_ANALYSIS_PROMPT, CONTENT_GENERATION_PROMPT } from "./context/tal-context";

// Gemini client
export { callGemini, isGeminiAvailable } from "./gemini/client";

/**
 * All available tools
 */
export const tools = {
  // New content generation tools
  "linkedin-extractor": () => import("./tools/linkedin-extractor").then((m) => m.linkedinExtractorTool),
  "personality-builder": () => import("./tools/personality-builder").then((m) => m.personalityBuilderTool),
  "content-generator": () => import("./tools/content-generator").then((m) => m.contentGeneratorTool),
  // Legacy tools
  "prompt-enhancer": () => import("./tools/prompt_enhancer").then((m) => m.promptEnhancerTool),
  "output-dispatcher": () => import("./tools/output_dispatcher").then((m) => m.outputDispatcherTool),
};

/**
 * All available workflows
 */
export const workflows = {
  "tal-content-generation": () =>
    import("./workflows/content-generation").then((m) => m.contentGenerationWorkflow),
  "cabal-of-strangers-v1": () => import("./flow").then((m) => m.flowMetadata),
};

/**
 * Mastra configuration object
 */
export const mastraConfig = {
  name: "Tal Content Engine",
  version: "2.0.0",
  tools: Object.keys(tools),
  workflows: Object.keys(workflows),
};

export default mastraConfig;
