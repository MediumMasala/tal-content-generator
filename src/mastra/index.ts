import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';

// Import tools
import { linkedinExtractorTool } from './tools/linkedin-extractor';
import { personalityBuilderTool } from './tools/personality-builder';
import { contentGeneratorTool } from './tools/content-generator';
import { linkedinOptimizerTool } from './tools/linkedin-optimizer';

/**
 * Tal Content Engine - Mastra Configuration
 *
 * A 4-tool pipeline for generating LinkedIn posts in someone's authentic voice:
 * 1. LinkedIn Extractor - Scrape profile data
 * 2. Personality Builder - Analyze and build personality profile
 * 3. Content Generator - Generate post with optional topic focus
 * 4. LinkedIn Optimizer - Optimize using viral post patterns
 */

// ============================================
// TOOLS EXPORT
// ============================================

export const tools = {
  linkedinExtractor: linkedinExtractorTool,
  personalityBuilder: personalityBuilderTool,
  contentGenerator: contentGeneratorTool,
  linkedinOptimizer: linkedinOptimizerTool,
};

// ============================================
// CONTENT GENERATION AGENT
// ============================================

export const contentAgent = new Agent({
  id: 'tal-content-agent',
  name: 'Tal Content Generation Agent',
  instructions: `You are an AI assistant that helps generate LinkedIn posts about Tal in someone's authentic voice.

You have access to 4 tools:
1. linkedin-extractor: Scrape LinkedIn profile data
2. personality-builder: Build personality profile from LinkedIn data
3. content-generator: Generate LinkedIn post in their voice
4. linkedin-optimizer: Optimize post using viral patterns

When asked to generate content:
1. First extract the LinkedIn profile (if not cached)
2. Build the personality profile (if not cached)
3. Generate content based on the user's requested topic (if any)
4. Optionally optimize the post

Always respect the user's voice and personality. Never make posts sound promotional or salesy.`,

  model: 'openai/gpt-5',

  tools: {
    linkedinExtractor: linkedinExtractorTool,
    personalityBuilder: personalityBuilderTool,
    contentGenerator: contentGeneratorTool,
    linkedinOptimizer: linkedinOptimizerTool,
  },
});

// ============================================
// MASTRA INSTANCE
// ============================================

export const mastra = new Mastra({
  agents: {
    contentAgent,
  },
  tools,
});

// ============================================
// WORKFLOW FUNCTION (Simpler than Mastra workflows)
// ============================================

export interface ContentGenerationInput {
  linkedinUrl: string;
  userTopic?: string;
  customContext?: string;
  forceRefresh?: boolean;
  regenerate?: boolean;
  skipOptimization?: boolean;
}

export interface ContentGenerationOutput {
  success: boolean;
  username: string;
  personName: string | null;
  currentRole: string | null;
  currentCompany: string | null;

  // Raw generated post
  rawPost: string;
  rawAltVersion: string;

  // Optimized versions (main + 3 alternatives)
  mainPost: string;
  altHook: string;
  altStructure: string;
  altShort: string;

  // Metadata
  topicUsed: string;
  topicConfidence: string;
  wordCount: number;
  optimizationNotes: string;

  // Timing
  timing: {
    extractionMs: number;
    personalityMs: number;
    generationMs: number;
    optimizationMs: number;
    totalMs: number;
  };

  error?: string;
}

/**
 * Execute the full content generation workflow
 */
export async function executeContentGeneration(
  input: ContentGenerationInput
): Promise<ContentGenerationOutput> {
  const startTime = Date.now();
  let extractionMs = 0;
  let personalityMs = 0;
  let generationMs = 0;
  let optimizationMs = 0;

  try {
    // Step 1: Extract LinkedIn profile
    console.log('[workflow] Step 1/4: Extracting LinkedIn profile...');
    const extractStart = Date.now();

    const extractResult = await linkedinExtractorTool.execute!({
      linkedinUrl: input.linkedinUrl,
      forceRefresh: input.forceRefresh || false,
    }, {} as any);

    extractionMs = Date.now() - extractStart;
    console.log(`[workflow] Extraction complete (${extractionMs}ms)`);

    // Step 2: Build personality
    console.log('[workflow] Step 2/4: Building personality...');
    const personalityStart = Date.now();

    const postCount = extractResult.profile.posts?.length || 0;
    const personalityResult = await personalityBuilderTool.execute!({
      username: extractResult.username,
      forceRefresh: input.forceRefresh || false,
      profileOnlyMode: postCount === 0,
    }, {} as any);

    personalityMs = Date.now() - personalityStart;
    console.log(`[workflow] Personality built (${personalityMs}ms)`);

    // Step 3: Generate content
    console.log('[workflow] Step 3/4: Generating content...');
    const generationStart = Date.now();

    const contentResult = await contentGeneratorTool.execute!({
      username: extractResult.username,
      userTopic: input.userTopic,
      customContext: input.customContext,
      regenerate: input.regenerate || false,
    }, {} as any);

    generationMs = Date.now() - generationStart;
    console.log(`[workflow] Content generated (${generationMs}ms)`);

    // Step 4: Optimize (optional)
    let optimizeResult = {
      mainPost: contentResult.post,
      altHook: '',
      altStructure: '',
      altShort: '',
      optimizationNotes: 'Optimization skipped',
    };

    if (!input.skipOptimization) {
      console.log('[workflow] Step 4/4: Optimizing...');
      const optimizeStart = Date.now();

      optimizeResult = await linkedinOptimizerTool.execute!({
        username: extractResult.username,
        rawPost: contentResult.post,
        altVersion: contentResult.altVersion,
      }, {} as any);

      optimizationMs = Date.now() - optimizeStart;
      console.log(`[workflow] Optimization complete (${optimizationMs}ms)`);
    } else {
      console.log('[workflow] Step 4/4: Skipping optimization');
    }

    const totalMs = Date.now() - startTime;
    console.log(`[workflow] Complete! Total time: ${totalMs}ms`);

    return {
      success: true,
      username: extractResult.username,
      personName: extractResult.profile.name,
      currentRole: extractResult.profile.currentRole,
      currentCompany: extractResult.profile.currentCompany,

      rawPost: contentResult.post,
      rawAltVersion: contentResult.altVersion,

      mainPost: optimizeResult.mainPost,
      altHook: optimizeResult.altHook,
      altStructure: optimizeResult.altStructure,
      altShort: optimizeResult.altShort,

      topicUsed: contentResult.topicUsed,
      topicConfidence: contentResult.topicConfidence,
      wordCount: contentResult.wordCount,
      optimizationNotes: optimizeResult.optimizationNotes,

      timing: {
        extractionMs,
        personalityMs,
        generationMs,
        optimizationMs,
        totalMs,
      },
    };
  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error('[workflow] Error:', error);

    return {
      success: false,
      username: '',
      personName: null,
      currentRole: null,
      currentCompany: null,
      rawPost: '',
      rawAltVersion: '',
      mainPost: '',
      altHook: '',
      altStructure: '',
      altShort: '',
      topicUsed: '',
      topicConfidence: '',
      wordCount: 0,
      optimizationNotes: '',
      timing: {
        extractionMs,
        personalityMs,
        generationMs,
        optimizationMs,
        totalMs,
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Default export
export default mastra;
