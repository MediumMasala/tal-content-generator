import { z } from "zod";
import OpenAI from "openai";
import {
  loadPersonality,
  saveGenerated,
  getGeneratedPath,
  loadTalContext,
  loadRawPosts,
} from "../storage/local-storage";

// Tool output schema
export const ContentGeneratorOutputSchema = z.object({
  username: z.string(),
  content: z.string(),
  angleUsed: z.string(),
  personalizationNotes: z.string(),
  confidenceScore: z.number(),
  storagePath: z.string(),
  generatedAt: z.string(),
});

export type ContentGeneratorOutput = z.infer<typeof ContentGeneratorOutputSchema>;

// Tool input schema
export const ContentGeneratorInputSchema = z.object({
  username: z.string(),
  customContext: z.string().optional(),
  forceNewGeneration: z.boolean().optional().default(true),
});

export type ContentGeneratorInput = z.infer<typeof ContentGeneratorInputSchema>;

/**
 * Build the JSON schema for GPT response
 */
function getResponseSchema() {
  return {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The actual LinkedIn post content",
      },
      angleUsed: {
        type: "string",
        description: "1 sentence explaining the angle used",
      },
      personalizationNotes: {
        type: "string",
        description: "What was matched from their profile",
      },
      confidenceScore: {
        type: "number",
        description: "0-100 score, cap at 60 if no writing style available",
      },
    },
    required: ["content", "angleUsed", "personalizationNotes", "confidenceScore"],
  };
}

/**
 * Content Generator Tool
 *
 * Generates LinkedIn posts in the person's voice about Tal.
 * The person has genuinely experienced Tal — impressed but understated, not salesy.
 */
export async function generateContent(
  input: ContentGeneratorInput
): Promise<ContentGeneratorOutput> {
  const { username, customContext } = input;

  // Load personality from storage
  const personalityData = loadPersonality(username);
  if (!personalityData) {
    throw new Error(`Personality not found for username: ${username}. Run personality-builder first.`);
  }

  // Load Tal context (system prompt, lore, chats)
  const talContext = loadTalContext();
  console.log(`[content-generator] Tal context available: ${talContext.available}`);
  if (!talContext.available) {
    console.log(`[content-generator] Warning: No Tal context found. Add files to data/tal/`);
  }

  // Load raw posts to calculate word count patterns
  const rawPosts = loadRawPosts(username);
  const wordCountStats = calculateWordCountStats(rawPosts?.data || []);
  console.log(`[content-generator] Word count target: ${wordCountStats.targetWords} words (based on ${wordCountStats.postsAnalyzed} posts)`);

  console.log(`[content-generator] Generating content for ${username}`);

  // Initialize OpenAI client
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-5.2";

  // Build the prompt with personality data
  const personalityContext = buildPersonalityContext(personalityData);

  // Build Tal understanding context
  const talUnderstandingContext = buildTalUnderstandingContext(talContext);

  // Build the system prompt (anti-salesy, genuine discovery)
  const systemPrompt = buildContentSystemPrompt(wordCountStats);

  const userPrompt = `## PERSON'S PERSONALITY & WRITING STYLE
${personalityContext}

## TAL - WHAT THIS PERSON HAS ACCESS TO UNDERSTAND
${talUnderstandingContext}

${customContext ? `## ADDITIONAL CONTEXT\n${customContext}\n` : ""}

## WORD COUNT TARGET
Write approximately ${wordCountStats.targetWords} words (${wordCountStats.targetChars} characters).
This matches their typical LinkedIn post length.

Generate a LinkedIn post as this person, having genuinely used/explored Tal.
They formed their own opinion. They're impressed but won't say it directly — that's not their style.
The post should reflect what they actually noticed about the product, not marketing claims.

Return a JSON object with: content, angleUsed, personalizationNotes, confidenceScore`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    let parsed;

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse GPT response as JSON");
      }
    }

    // Check if writing style is available (support both old and new format)
    const analysis = personalityData.analysis || personalityData;
    const writingStyleAvailable =
      analysis.autoWritingGraph?.toneProfile?.length > 0 ||
      analysis.writingStyle?.available ||
      personalityData.writingStyle?.available ||
      false;

    // Cap confidence score at 60 if no writing style
    if (!writingStyleAvailable && parsed.confidenceScore > 60) {
      parsed.confidenceScore = 60;
    }

    const generatedAt = new Date().toISOString();
    const timestamp = generatedAt.replace(/[:.]/g, "-");

    // Save to storage
    const storageData = {
      username,
      generatedAt,
      content: parsed.content,
      angleUsed: parsed.angleUsed,
      personalizationNotes: parsed.personalizationNotes,
      confidenceScore: parsed.confidenceScore,
      writingStyleAvailable,
      customContext: customContext || null,
    };

    const storagePath = saveGenerated(username, storageData);

    console.log(`[content-generator] Content saved to ${storagePath}`);

    return {
      username,
      content: parsed.content,
      angleUsed: parsed.angleUsed,
      personalizationNotes: parsed.personalizationNotes,
      confidenceScore: parsed.confidenceScore,
      storagePath,
      generatedAt,
    };
  } catch (error) {
    console.error(`[content-generator] Error generating content:`, error);
    throw new Error(`Failed to generate content: ${error}`);
  }
}

/**
 * Build a context string from personality data for the LLM
 * Supports both old and new comprehensive analysis format
 */
function buildPersonalityContext(personalityData: any): string {
  // Check if it's the new comprehensive format
  const analysis = personalityData.analysis || personalityData;

  // If it has the new structure
  if (analysis.profileSnapshot || analysis.personalityGraph || analysis.autoWritingGraph) {
    return buildComprehensiveContext(analysis);
  }

  // Fall back to old format
  return buildLegacyContext(personalityData);
}

/**
 * Build context from the new comprehensive analysis format
 */
function buildComprehensiveContext(analysis: any): string {
  const sections = [];

  // Profile Snapshot
  if (analysis.profileSnapshot) {
    const ps = analysis.profileSnapshot;
    sections.push(`### PROFILE SNAPSHOT
${ps.summary || ""}
- Current Role: ${ps.currentRole || "Unknown"}
- Current Company: ${ps.currentCompany || "Unknown"}
- Seniority: ${ps.seniority || "Unknown"}
- Domain: ${ps.domain || "Unknown"}`);
  }

  // Personality Graph - Dominant Summary
  if (analysis.personalityGraph) {
    const pg = analysis.personalityGraph;
    sections.push(`### PERSONALITY GRAPH
${pg.dominantPersonalitySummary || ""}

- Core Identity: ${pg.coreIdentity?.inference || "Unknown"}
- Ambition Pattern: ${pg.ambitionPattern?.inference || "Unknown"}
- Communication Style: ${pg.communicationStyle?.inference || "Unknown"}
- Working Style: ${pg.workingStyle?.inference || "Unknown"}
- Public Brand Intent: ${pg.publicBrandIntent?.inference || "Unknown"}
- Emotional Texture: ${pg.emotionalTexture?.inference || "Unknown"}`);
  }

  // Knowledge Graph
  if (analysis.knowledgeGraph) {
    const kg = analysis.knowledgeGraph;
    const deepTopics = (kg.deepKnowledge || []).map((k: any) => k.topic).join(", ");
    const workingTopics = (kg.strongWorkingKnowledge || []).map((k: any) => k.topic).join(", ");

    sections.push(`### KNOWLEDGE GRAPH
- Deep Knowledge: ${deepTopics || "None identified"}
- Working Knowledge: ${workingTopics || "None identified"}
- Industry Lens: ${kg.industryLens || "Unknown"}
- Functional Lens: ${kg.functionalLens || "Unknown"}`);
  }

  // Auto-Writing Graph - THE MOST IMPORTANT PART FOR CONTENT GENERATION
  if (analysis.autoWritingGraph) {
    const awg = analysis.autoWritingGraph;
    const toneProfile = (awg.toneProfile || []).join(", ");
    const wc = awg.writingCharacteristics || {};
    const habits = awg.lexicalFormattingHabits || {};

    sections.push(`### WRITING STYLE (CRITICAL - MATCH THIS EXACTLY)

TONE PROFILE: ${toneProfile}

WRITING CHARACTERISTICS:
- Sentence Length: ${wc.sentenceLength || "Unknown"}
- Directness: ${wc.directness || "Unknown"}
- Authority: ${wc.authority || "Unknown"}
- Warmth: ${wc.warmth || "Unknown"}
- Emotional Openness: ${wc.emotionalOpenness || "Unknown"}
- Hook Style: ${wc.hookStyle || "Unknown"}
- CTA Behavior: ${wc.ctaBehavior || "Unknown"}

RHETORICAL DEVICES: ${(awg.rhetoricalDevices || []).join(", ")}

SIGNATURE MOVES: ${(awg.signatureWritingMoves || []).join("; ")}

FORMATTING HABITS:
- Short Lines: ${habits.shortLines ? "Yes" : "No"}
- Spaced Paragraphs: ${habits.spacedParagraphs ? "Yes" : "No"}
- Emoji Usage: ${habits.emojiUsage || "Unknown"}
- Em Dash Usage: ${habits.emDashUsage ? "Yes" : "No"}
- Rhetorical Questions: ${habits.rhetoricalQuestions ? "Yes" : "No"}

IMITATION GUIDANCE: ${awg.writingImitationGuidance || "Match their natural voice"}

ANTI-PATTERNS (NEVER DO THESE): ${(awg.antiPatterns || []).join("; ")}`);
  }

  // Persona Prompt - Direct instruction for downstream model
  if (analysis.personaPrompt) {
    sections.push(`### PERSONA PROMPT (USE THIS AS YOUR GUIDE)
${analysis.personaPrompt}`);
  }

  // Tal Compatibility Layer
  if (analysis.talCompatibilityLayer) {
    const tcl = analysis.talCompatibilityLayer;
    sections.push(`### TAL COMPATIBILITY
- How they'd perceive Tal: ${tcl.howTheyWouldPerceiveTal || "Unknown"}
- Messaging that resonates: ${tcl.messagingStyleThatResonates || "Unknown"}
- Messaging that repels: ${tcl.messagingStyleThatRepels || "Unknown"}
- Humor tolerance: ${tcl.humorTolerance || "Medium"}
- Preferred tone: ${tcl.preferredTone || "Unknown"}
- How Tal should adapt: ${tcl.howTalShouldAdapt || "Be authentic"}`);
  }

  return sections.join("\n\n");
}

/**
 * Build context from the legacy format (backward compatibility)
 */
function buildLegacyContext(personalityData: any): string {
  const { personality, knowledgeGraph, writingStyle } = personalityData;

  const sections = [];

  // Personality section
  if (personality) {
    sections.push(`### PERSONALITY
- Traits: ${(personality.traits || personality.coreTraits || []).join(", ")}
- Values: ${(personality.values || []).join(", ")}
- Communication Style: ${personality.communicationStyle?.summary || personality.communicationStyle || "Unknown"}
- Professional Identity: ${personality.professionalIdentity || "Unknown"}
- Pain Points: ${(personality.painPoints || []).join(", ")}
- Aspirations: ${(personality.aspirations || []).join(", ")}`);
  }

  // Knowledge graph section
  if (knowledgeGraph) {
    sections.push(`### KNOWLEDGE GRAPH
- Industries: ${(knowledgeGraph.industries || []).join(", ")}
- Technologies: ${(knowledgeGraph.technologiesTools || knowledgeGraph.technologies || []).join(", ")}
- Skills: ${(knowledgeGraph.skills || []).join(", ")}
- Topics: ${(knowledgeGraph.topics || []).join(", ")}`);
  }

  // Writing style section
  if (writingStyle && writingStyle.available !== false) {
    sections.push(`### WRITING STYLE (MATCH THIS CLOSELY)
- Voice Summary: ${writingStyle.voiceSummary || "N/A"}
- Sentence Patterns: ${(writingStyle.sentenceStructurePatterns || []).join("; ") || "N/A"}
- Signature Phrases: ${(writingStyle.signaturePhrases || []).join("; ") || "None"}
- Things they NEVER do: ${(writingStyle.thingsTheyNEVERDo || writingStyle.thingsToAvoid || []).join("; ") || "None"}`);
  } else {
    sections.push(`### WRITING STYLE
- NOT AVAILABLE
- Use personality traits to guide tone
- Keep post shorter (500-800 chars)`);
  }

  return sections.join("\n\n");
}

/**
 * Calculate word count statistics from the person's posts
 */
function calculateWordCountStats(posts: any[]): {
  avgWords: number;
  avgChars: number;
  targetWords: number;
  targetChars: number;
  postsAnalyzed: number;
} {
  if (!posts || posts.length === 0) {
    // Default if no posts available
    return {
      avgWords: 120,
      avgChars: 700,
      targetWords: 120,
      targetChars: 700,
      postsAnalyzed: 0,
    };
  }

  // Analyze word counts from their posts
  const wordCounts: number[] = [];
  const charCounts: number[] = [];

  for (const post of posts) { // Use ALL posts for comprehensive analysis
    const text = post.text || "";
    if (text.length > 50) { // Only count substantive posts
      const words = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      wordCounts.push(words);
      charCounts.push(text.length);
    }
  }

  if (wordCounts.length === 0) {
    return {
      avgWords: 120,
      avgChars: 700,
      targetWords: 120,
      targetChars: 700,
      postsAnalyzed: 0,
    };
  }

  const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
  const avgChars = Math.round(charCounts.reduce((a, b) => a + b, 0) / charCounts.length);

  return {
    avgWords,
    avgChars,
    targetWords: avgWords,
    targetChars: avgChars,
    postsAnalyzed: wordCounts.length,
  };
}

/**
 * Build context from Tal's actual data (system prompt, lore, chats)
 */
function buildTalUnderstandingContext(talContext: {
  systemPrompt: string | null;
  lore: string | null;
  chats: Array<{ filename: string; content: any }>;
  available: boolean;
}): string {
  const sections: string[] = [];

  if (talContext.systemPrompt) {
    sections.push(`### TAL'S SYSTEM PROMPT (How Tal operates)
${talContext.systemPrompt}`);
  }

  if (talContext.lore) {
    sections.push(`### TAL'S BACKSTORY & WORLD
${talContext.lore}`);
  }

  if (talContext.chats && talContext.chats.length > 0) {
    sections.push(`### SAMPLE TAL CONVERSATIONS (${talContext.chats.length} examples)`);

    for (const chat of talContext.chats.slice(0, 3)) { // Limit to 3 chats
      const chatContent = typeof chat.content === "string"
        ? chat.content
        : JSON.stringify(chat.content, null, 2);

      // Truncate if too long
      const truncated = chatContent.length > 2000
        ? chatContent.slice(0, 2000) + "\n... [truncated]"
        : chatContent;

      sections.push(`\n#### ${chat.filename}\n${truncated}`);
    }
  }

  if (sections.length === 0) {
    return `No Tal context files found.
Please add:
- data/tal/system-prompt.md (Tal's system prompt)
- data/tal/lore.md (Tal's backstory/fictional world)
- data/tal/chats/*.json (Sample Tal conversations)`;
  }

  return sections.join("\n\n");
}

/**
 * Build the content generation system prompt (anti-salesy, genuine discovery)
 */
function buildContentSystemPrompt(wordCountStats: { targetWords: number; targetChars: number }): string {
  return `You are ghostwriting a LinkedIn post for a specific person who has genuinely explored Tal.

## YOUR TASK
Write a LinkedIn post as this person. They've used Tal, formed their own opinion, and are sharing their reaction.

## CRITICAL RULES

### 1. VOICE AUTHENTICITY
- Match their writing style EXACTLY (sentence structure, formatting, word choice)
- Use their signature moves and rhetorical devices
- NEVER do things in their anti-patterns list
- If they don't use emojis, don't add emojis
- If they write short punchy lines, write short punchy lines

### 2. ANTI-SALESY — THIS IS NOT AN AD
- They're impressed but WON'T say "this is amazing" or "game-changer"
- No superlatives: avoid "revolutionary", "incredible", "best thing ever"
- No fear-based messaging: avoid "you're missing out", "don't fall behind"
- No direct CTAs: avoid "sign up now", "try it today", "link in comments"
- The post should feel like a genuine observation, not a promotion

### 3. SUBSTANCE OVER MARKETING
- Reference SPECIFIC things about Tal from the context provided
- What did they actually notice? What stood out?
- Connect it to their professional reality and pain points
- Show don't tell — describe what Tal does, not how great it is

### 4. THE IMPRESSED-BUT-UNDERSTATED VIBE
- They noticed something interesting. They're sharing it.
- Their tone should match their personality (if they're contrarian, stay contrarian)
- If they're skeptical by nature, the post can acknowledge that
- The mention of tal.af should be natural and brief (if at all)

### 5. WORD COUNT
- Target: ~${wordCountStats.targetWords} words (~${wordCountStats.targetChars} characters)
- This matches their typical posting length
- Don't pad with filler. If the message is complete in fewer words, that's fine.

## OUTPUT FORMAT
Return JSON:
{
  "content": "<the LinkedIn post>",
  "angleUsed": "<1 sentence: what angle you took based on their profile>",
  "personalizationNotes": "<what you matched from their personality/style>",
  "confidenceScore": 0-100  // cap at 60 if no writing style available
}

Remember: This person has a reputation. The post must sound like something they would actually write.`;
}

/**
 * Tool definition for Mastra
 */
export const contentGeneratorTool = {
  id: "content-generator",
  name: "Content Generator",
  description: "Generate LinkedIn post about Tal in person's voice",
  inputSchema: ContentGeneratorInputSchema,
  outputSchema: ContentGeneratorOutputSchema,
  execute: generateContent,
};

export default contentGeneratorTool;
