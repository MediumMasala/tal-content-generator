import { z } from "zod";
import { extractLinkedIn } from "../tools/linkedin-extractor";
import { buildPersonality } from "../tools/personality-builder";
import { generateLinkedInPost } from "../tools/linkedin-post-generator";
import { extractUsername, loadPersonality, loadTalContext, loadRawPosts } from "../storage/local-storage";

/**
 * Helper functions to extract personality data
 */
function extractTraits(personalityGraph: any): string[] {
  const traits: string[] = [];
  const traitFields = ['coreIdentity', 'workingStyle', 'intellectualStyle', 'emotionalTexture'];

  for (const field of traitFields) {
    if (personalityGraph[field]?.inference) {
      // Extract key trait from inference
      const inference = personalityGraph[field].inference;
      const firstPart = inference.split(';')[0].split(',')[0].trim();
      if (firstPart.length < 50) {
        traits.push(firstPart);
      }
    }
  }
  return traits.slice(0, 5);
}

function extractValues(personalityGraph: any): string[] {
  const values: string[] = [];
  const valueFields = ['careerMotivation', 'statusOrientation', 'publicBrandIntent'];

  for (const field of valueFields) {
    if (personalityGraph[field]?.inference) {
      const inference = personalityGraph[field].inference;
      const firstPart = inference.split(';')[0].split(',')[0].trim();
      if (firstPart.length < 50) {
        values.push(firstPart);
      }
    }
  }
  return values.slice(0, 4);
}

function extractTopics(knowledgeGraph: any): string[] {
  const topics: string[] = [];

  // Extract from deepKnowledge
  if (knowledgeGraph.deepKnowledge) {
    for (const item of knowledgeGraph.deepKnowledge.slice(0, 3)) {
      if (item.topic) {
        const shortTopic = item.topic.split('(')[0].trim();
        topics.push(shortTopic);
      }
    }
  }

  return topics;
}

/**
 * Workflow Input Schema
 */
export const ContentGenerationInputSchema = z.object({
  linkedinUrl: z.string().url(),
  forceRefresh: z.boolean().optional().default(false),
  customContext: z.string().optional(),
  regenerate: z.boolean().optional().default(false), // Skip extraction/personality, just regenerate content
});

export type ContentGenerationInput = z.infer<typeof ContentGenerationInputSchema>;

/**
 * Workflow Output Schema
 */
export const ContentGenerationOutputSchema = z.object({
  success: z.boolean(),
  personName: z.string().nullable(),
  currentRole: z.string().nullable(),
  currentCompany: z.string().nullable(),
  username: z.string(),
  content: z.string(),
  altVersion: z.string(),
  angleUsed: z.string(),
  personalizationNotes: z.string(),
  confidenceScore: z.number(),
  writingStyleAvailable: z.boolean(),
  postCount: z.number(),
  originalPostCount: z.number(), // Original posts (not reposts)
  averageWordCount: z.number().nullable(), // Avg word count of original posts
  personality: z.object({
    traits: z.array(z.string()),
    values: z.array(z.string()),
    communicationStyle: z.string(),
    professionalIdentity: z.string().nullable(),
  }).nullable(),
  knowledgeGraph: z.object({
    industries: z.array(z.string()),
    technologies: z.array(z.string()),
    topics: z.array(z.string()),
  }).nullable(),
  writingStyle: z.object({
    voiceSummary: z.string().nullable(),
    toneAttributes: z.array(z.string()),
    formattingPatterns: z.object({
      usesEmojis: z.boolean(),
      usesHashtags: z.boolean(),
      usesLineBreaks: z.boolean(),
    }).nullable(),
  }).nullable(),
  // Raw analysis for logging (NEW)
  rawAnalysis: z.object({
    signalMode: z.string().nullable(),
    personalityBlurb: z.string().nullable(),
    writingStyleSummary: z.string().nullable(),
    talResonationAngle: z.string().nullable(),
  }).nullable(),
  storagePaths: z.object({
    profile: z.string(),
    personality: z.string(),
    generated: z.string(),
  }),
  timing: z.object({
    extractionMs: z.number(),
    personalityMs: z.number(),
    generationMs: z.number(),
    totalMs: z.number(),
  }),
});

export type ContentGenerationOutput = z.infer<typeof ContentGenerationOutputSchema>;

/**
 * Workflow Error Output
 */
export interface ContentGenerationError {
  success: false;
  error: string;
  step: "extraction" | "personality" | "generation";
  username?: string;
}

/**
 * Execute the content generation workflow
 *
 * This workflow:
 * 1. Extracts LinkedIn profile data using Apify
 * 2. Builds personality profile using GPT
 * 3. Generates content in the person's voice
 */
export async function executeContentGeneration(
  input: ContentGenerationInput
): Promise<ContentGenerationOutput | ContentGenerationError> {
  const startTime = Date.now();
  let extractionMs = 0;
  let personalityMs = 0;
  let generationMs = 0;

  // Extract username first for error context
  let username: string;
  try {
    username = extractUsername(input.linkedinUrl);
  } catch (error) {
    return {
      success: false,
      error: `Invalid LinkedIn URL: ${error}`,
      step: "extraction",
    };
  }

  const isRegeneration = input.regenerate || false;
  console.log(`[workflow] Starting ${isRegeneration ? 'REGENERATION' : 'content generation'} for ${username}`);
  console.log(`[workflow] LinkedIn URL: ${input.linkedinUrl}`);

  // Step 1: Extract LinkedIn profile
  console.log(`[workflow] Step 1/3: Extracting LinkedIn profile...`);
  const extractionStart = Date.now();
  let extractionResult;

  try {
    extractionResult = await extractLinkedIn({
      linkedinUrl: input.linkedinUrl,
      forceRefresh: input.forceRefresh,
    });
    extractionMs = Date.now() - extractionStart;
    console.log(`[workflow] Extraction complete (${extractionMs}ms)`);
  } catch (error) {
    return {
      success: false,
      error: `LinkedIn extraction failed: ${error}`,
      step: "extraction",
      username,
    };
  }

  // Check post count - determines which prompts to use
  const postCount = extractionResult.profile.posts?.length || 0;
  const hasNoPosts = postCount === 0;

  if (hasNoPosts) {
    console.log(`[workflow] User ${username} has zero posts - using profile-only analysis flow`);
  }

  // Step 2: Build personality profile
  console.log(`[workflow] Step 2/3: Building personality profile...`);
  const personalityStart = Date.now();
  let personalityResult;

  try {
    personalityResult = await buildPersonality({
      username,
      forceRefresh: input.forceRefresh,
      profileOnlyMode: hasNoPosts, // Use profile-only analysis for zero-posts users
    });
    personalityMs = Date.now() - personalityStart;
    console.log(`[workflow] Personality built (${personalityMs}ms)`);
  } catch (error) {
    return {
      success: false,
      error: `Personality building failed: ${error}`,
      step: "personality",
      username,
    };
  }

  // Step 3: Generate content using linkedin-post-generator (Gemini)
  console.log(`[workflow] Step 3/3: Generating content...`);
  const generationStart = Date.now();
  let generationResult;

  try {
    // Load personality data for the generator
    const personalityData = loadPersonality(username);
    if (!personalityData) {
      throw new Error(`Personality data not found for ${username}`);
    }

    // Load Tal context
    const talContext = loadTalContext();

    // Load raw posts for word count analysis
    const rawPosts = loadRawPosts(username);

    // Build input for linkedin-post-generator
    const generatorInput = {
      personality: {
        username,
        profileSnapshot: personalityData.analysis?.profileSnapshot,
        personalityGraph: personalityData.analysis?.personalityGraph,
        knowledgeGraph: personalityData.analysis?.knowledgeGraph,
        // Newest schema fields
        writingGraph: personalityData.analysis?.writingGraph,
        lexicalGraph: personalityData.analysis?.lexicalGraph,
        voiceLandmines: personalityData.analysis?.voiceLandmines,
        finalWriterGuidance: personalityData.analysis?.finalWriterGuidance,
        // Older schemas for backward compatibility
        autoWritingGraph: personalityData.analysis?.autoWritingGraph,
        writingStyleGraph: personalityData.analysis?.writingStyleGraph,
        personaPrompt: personalityData.analysis?.personaPrompt,
        talCompatibilityLayer: personalityData.analysis?.talCompatibilityLayer,
      },
      tal: {
        systemPrompt: talContext.systemPrompt || undefined,
        lore: talContext.lore || undefined,
        sampleChats: talContext.chats.map((c: any) => c.content),  // Pass all chats for personality matching
      },
      rawPosts: rawPosts?.data || [],
      options: {
        customContext: input.customContext,
        profileOnlyMode: hasNoPosts, // Use profile-only generation for zero-posts users
        regenerate: isRegeneration, // Force different chats/angle on regeneration
      },
    };

    const result = await generateLinkedInPost(generatorInput);

    // Map result to expected format
    generationResult = {
      content: result.post,
      altVersion: result.altVersion,
      angleUsed: result.fitRationale,
      personalizationNotes: result.fitRationale,
      confidenceScore: 75, // Default confidence for Gemini
      storagePath: result.storagePath || "",
    };

    generationMs = Date.now() - generationStart;
    console.log(`[workflow] Content generated (${generationMs}ms)`);
  } catch (error) {
    return {
      success: false,
      error: `Content generation failed: ${error}`,
      step: "generation",
      username,
    };
  }

  const totalMs = Date.now() - startTime;

  console.log(`[workflow] Workflow complete!`);
  console.log(`[workflow] Total time: ${totalMs}ms`);
  console.log(`[workflow] Confidence score: ${generationResult.confidenceScore}`);

  // Load full personality data for response
  const fullPersonalityData = loadPersonality(username);
  // postCount already declared earlier when checking for zero posts

  return {
    success: true,
    personName: extractionResult.profile.name,
    currentRole: extractionResult.profile.currentRole || null,
    currentCompany: extractionResult.profile.currentCompany || null,
    username,
    content: generationResult.content,
    altVersion: generationResult.altVersion,
    angleUsed: generationResult.angleUsed,
    personalizationNotes: generationResult.personalizationNotes,
    confidenceScore: generationResult.confidenceScore,
    writingStyleAvailable: personalityResult.writingStyle?.available ?? false,
    postCount,
    originalPostCount: extractionResult.originalPostCount,
    averageWordCount: extractionResult.averageWordCount,
    personality: fullPersonalityData?.analysis?.personalityGraph ? {
      traits: extractTraits(fullPersonalityData.analysis.personalityGraph),
      values: extractValues(fullPersonalityData.analysis.personalityGraph),
      communicationStyle: fullPersonalityData.analysis.personalityGraph.communicationStyle || '',
      professionalIdentity: fullPersonalityData.analysis.personalityGraph.dominantPersonalitySummary || null,
    } : null,
    knowledgeGraph: fullPersonalityData?.analysis?.knowledgeGraph ? {
      industries: [fullPersonalityData.analysis.knowledgeGraph.industryLens].filter(Boolean),
      technologies: [fullPersonalityData.analysis.knowledgeGraph.technicalLens].filter(Boolean),
      topics: extractTopics(fullPersonalityData.analysis.knowledgeGraph),
    } : null,
    writingStyle: fullPersonalityData?.analysis?.autoWritingGraph ? {
      voiceSummary: fullPersonalityData.analysis.autoWritingGraph.writingAlignmentGuidance || null,
      toneAttributes: fullPersonalityData.analysis.autoWritingGraph.toneProfile || [],
      formattingPatterns: fullPersonalityData.analysis.autoWritingGraph.lexicalFormattingHabits || null,
    } : null,
    // Raw analysis for logging (NEW schema)
    rawAnalysis: fullPersonalityData?.analysis ? {
      signalMode: fullPersonalityData.analysis.signalAnalysis?.mode || null,
      personalityBlurb: fullPersonalityData.analysis.personalityGraph?.dominantPersonalityBlurb || null,
      writingStyleSummary: fullPersonalityData.analysis.writingStyleGraph?.styleSummary || null,
      talResonationAngle: fullPersonalityData.analysis.talCompatibilityLayer?.resonationAngle || null,
    } : null,
    storagePaths: {
      profile: extractionResult.storagePath,
      personality: personalityResult.storagePath,
      generated: generationResult.storagePath,
    },
    timing: {
      extractionMs,
      personalityMs,
      generationMs,
      totalMs,
    },
  };
}

/**
 * Workflow metadata for Mastra
 */
export const contentGenerationWorkflow = {
  id: "tal-content-generation",
  name: "Tal Content Generation",
  description: "Generate LinkedIn posts about Tal in a person's authentic voice",
  inputSchema: ContentGenerationInputSchema,
  outputSchema: ContentGenerationOutputSchema,
  steps: [
    { name: "Extract LinkedIn", tool: "linkedin-extractor" },
    { name: "Build Personality", tool: "personality-builder" },
    { name: "Generate Content", tool: "linkedin-post-generator" },
  ],
  execute: executeContentGeneration,
};

export default contentGenerationWorkflow;
