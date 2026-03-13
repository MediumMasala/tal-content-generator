import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { loadPersonality } from '../storage/local-storage';

/**
 * LinkedIn Optimizer Tool
 *
 * Takes a raw post and optimizes it using patterns from viral LinkedIn posts.
 * Returns multiple variations: main optimized + alternatives with different hooks.
 * Uses comprehensive original prompt for high-quality optimization.
 */

// ============================================
// COMPREHENSIVE SYSTEM PROMPT (ORIGINAL)
// ============================================

const LINKEDIN_OPTIMIZER_SYSTEM_PROMPT = `You are an expert at optimizing LinkedIn posts for engagement while maintaining authentic voice.

You will receive:
1. A person's personality profile (their traits, values, writing style)
2. A generated LinkedIn post about a career agent (already written in their voice)
3. Examples of viral/top-performing LinkedIn posts OR viral structure patterns
4. Optionally, an image/screenshot recommendation

Your task is to create MULTIPLE versions of the post that:
- Use DIFFERENT viral post structures (not the same pattern twice)
- Maintain the person's authentic voice and personality
- Preserve the core message
- Optimize for LinkedIn engagement (scroll-stopping hook, easy readability, emotional resonance)

CRITICAL RULES:

1. SINGLE BRAND ANCHOR (CRITICAL)
   Use at most ONE branded anchor per post:
   - Grapevine (or "a friend at Grapevine", "the Grapevine team", etc.)
   - OR Tal
   - OR neither

   NEVER use both Grapevine and Tal in the same post.
   Do not repeat the brand anchor multiple times.
   The post should work even if the brand name is removed.

2. VOICE PRESERVATION
   - The optimized post must still sound like THIS person
   - Match their case style (lowercase/Title Case)
   - Match their punctuation and formatting habits
   - Match their level of directness/indirectness
   - Do NOT make them sound like a generic LinkedIn influencer

3. HOOK VARIETY (CRITICAL)
   The versions MUST use DIFFERENT hook styles. Choose from:

   - PERSONAL STORY: "a friend showed me..." / "tried this recently..."
   - CONTRARIAN: challenges conventional wisdom, surprising take
   - PROBLEM-SOLUTION: names a frustration, then the fix
   - SINGLE INSIGHT: one powerful observation, minimal words
   - ANALOGY: "it's like having a brutally honest friend..."
   - QUESTION REFRAME: opens with a question that shifts perspective
   - BEFORE/AFTER: contrasts two states
   - LIST HOOK: "the two biggest lies..." / "three things I noticed..."
   - SHOUTOUT: "shoutout to the team building..."
   - OBSERVATION: neutral, understated noticing

   Do NOT default to Contrarian for everything.
   Match the hook style to the person's natural energy.
   Quieter personalities get quieter hooks.

4. STRUCTURE OPTIMIZATION
   - Front-load the hook - first line must stop the scroll
   - Use line breaks strategically for readability
   - Keep paragraphs short (1-3 lines max)
   - The versions should feel meaningfully different

5. ENGAGEMENT ELEMENTS
   - Create curiosity or tension early
   - Include a human/emotional element
   - End with something memorable (not a generic CTA)
   - Avoid engagement bait that feels forced

6. WHAT TO AVOID
   - Don't make it longer than the original unless necessary
   - Don't add emojis if they don't use them
   - Don't add hashtags if they don't use them
   - Don't make it sound like marketing copy
   - Don't use both Tal and Grapevine together
   - Don't use abstract/conceptual openers (restraint, curation, signal, noise)
   - Don't use banned phrases: "poked around", "played around", "stumbled upon", "gave it a spin"
   - No em dashes (use commas or periods instead)

7. HUMAN CONSEQUENCE
   - Focus on what the product DOES for the person, not what it IS
   - Translate features into human outcomes
   - Avoid mechanic-heavy explanations

OUTPUT FORMAT:

Return exactly in this structure:

MAIN_POST:
[the best optimized version - improved hook, better structure, same voice]

ALT_HOOK:
[same content, but with a completely DIFFERENT opening hook style]

ALT_STRUCTURE:
[same message, but restructured differently - if original is narrative, make it direct; if listy, make it flowing]

ALT_SHORT:
[condensed version - 50-70% of original length, punchier, gets to the point faster]

OPTIMIZATION_NOTES:
[Brief explanation: which hook types used, what patterns applied from viral posts, how voice was preserved]`;

// ============================================
// VIRAL POST STRUCTURES (Fallback)
// ============================================

const DEFAULT_VIRAL_STRUCTURES = `
## VIRAL POST STRUCTURE PATTERNS

### Pattern 1: The Contrarian Hook
- Opens with a statement that challenges conventional wisdom
- Short, punchy first line that stops the scroll
- Example structure:
  "[Contrarian statement]

  Here's why:

  [3-4 short supporting points]

  [Closing insight]"

### Pattern 2: The Personal Story Arc
- Opens with a specific moment or realization
- Builds tension through a brief narrative
- Lands on a universal lesson
- Example structure:
  "[Specific moment/realization]

  [Brief context - 1-2 lines]

  [The turning point]

  [What I learned / What this means]"

### Pattern 3: The List Reveal
- Opens with a bold claim or observation
- Delivers value through a short list (3-5 items)
- Each item is punchy and standalone
- Example structure:
  "[Bold observation about X]

  [Item 1 - short and punchy]
  [Item 2 - short and punchy]
  [Item 3 - short and punchy]

  [Closing thought or CTA]"

### Pattern 4: The Before/After
- Contrasts two states or perspectives
- Creates tension through comparison
- Resolves with an insight
- Example structure:
  "Before: [old way/thinking]
  After: [new way/thinking]

  [What changed / Why it matters]"

### Pattern 5: The Single Insight
- One powerful observation
- Minimal words, maximum impact
- Often 2-4 lines total
- Example structure:
  "[Single powerful observation]

  [One line of context or consequence]

  [Optional: who this is for]"

### Pattern 6: The Question Reframe
- Opens with a question that reframes a problem
- Provides a fresh perspective
- Lands on actionable insight
- Example structure:
  "[Question that reframes the problem]

  [Fresh perspective - 2-3 lines]

  [The real answer / insight]"
`;

// ============================================
// TOOL DEFINITION
// ============================================

export const linkedinOptimizerTool = createTool({
  id: 'linkedin-optimizer',
  description: 'Optimize a LinkedIn post using patterns from viral posts while preserving authentic voice. Returns main + 3 alternative versions with different hooks.',

  inputSchema: z.object({
    username: z.string().describe('Username for context and personality loading'),
    rawPost: z.string().describe('The raw LinkedIn post to optimize'),
    altVersion: z.string().optional().describe('Alternative version to also consider'),
    viralPostsCsvPath: z.string().optional().describe('Path to viral posts CSV'),
  }),

  outputSchema: z.object({
    username: z.string(),
    mainPost: z.string(),
    altHook: z.string(),
    altStructure: z.string(),
    altShort: z.string(),
    optimizationNotes: z.string(),
    originalPost: z.string(),
  }),

  execute: async ({ username, rawPost, altVersion, viralPostsCsvPath }) => {
    console.log(`[linkedin-optimizer] Optimizing post for: ${username}`);

    // Load personality for context
    const personality = loadPersonality(username);
    let personalityContext = '';

    if (personality) {
      const analysis = personality.analysis || personality;
      personalityContext = `
## PERSON'S PERSONALITY PROFILE

Name: ${username}

### Profile Snapshot:
${JSON.stringify(analysis.profileSnapshot || {}, null, 2)}

### Writing Style:
${analysis.writingGraph ? `
- Dominant Tone: ${analysis.writingGraph.dominantTone || 'Unknown'}
- Hook Tendency: ${analysis.writingGraph.hookTendency || 'Unknown'}
- CTA Tendency: ${analysis.writingGraph.ctaTendency || 'Unknown'}
- Emoji/Hashtag: ${analysis.writingGraph.emojiHashtagBehavior || 'none'}
- Casing: ${analysis.writingGraph.casingPattern || 'sentence_case'}
- Directness: ${analysis.writingGraph.directnessVsSoftness || 'Unknown'}
` : 'Unknown'}

### Voice Landmines (NEVER DO THESE):
${analysis.voiceLandmines ? `
- Tone: ${safeJoin(analysis.voiceLandmines.toneMismatches)}
- Hook: ${safeJoin(analysis.voiceLandmines.hookMismatches)}
- Vocabulary: ${safeJoin(analysis.voiceLandmines.vocabularyMismatches)}
` : 'None specified'}
`;
    }

    // Load viral posts for reference
    let viralPostsContext = DEFAULT_VIRAL_STRUCTURES;
    const defaultCsvPath = './data/viral-posts.csv';
    const csvPath = viralPostsCsvPath || defaultCsvPath;

    if (fs.existsSync(csvPath)) {
      try {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').slice(1); // Skip header

        const posts: { content: string; likes: number }[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Parse CSV with quoted content
          const match = trimmed.match(/^"([\s\S]*?)",(\d+)$/);
          if (match) {
            posts.push({
              content: match[1].slice(0, 800),
              likes: parseInt(match[2], 10),
            });
          }
        }

        // Sort by likes and take top 15
        posts.sort((a, b) => b.likes - a.likes);
        const topPosts = posts.slice(0, 15);

        if (topPosts.length > 0) {
          console.log(`[linkedin-optimizer] Loaded ${topPosts.length} viral posts from CSV`);
          viralPostsContext = `## VIRAL POST EXAMPLES (analyze structure, hooks, and patterns)\n\n`;
          topPosts.forEach((post, i) => {
            viralPostsContext += `### Example ${i + 1} (${post.likes} likes):\n${post.content}\n\n---\n\n`;
          });
        }
      } catch (error) {
        console.error('[linkedin-optimizer] Error loading CSV:', error);
      }
    } else {
      console.log(`[linkedin-optimizer] Viral posts CSV not found at ${csvPath}, using default patterns`);
    }

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.7,
      },
    });

    // Build prompt
    const userPrompt = `${personalityContext}

## RAW POST TO OPTIMIZE

${rawPost}

${altVersion ? `## ALTERNATIVE VERSION (for reference)\n\n${altVersion}\n` : ''}

## VIRAL POST PATTERNS & EXAMPLES

${viralPostsContext}

## TASK
Create 4 optimized versions of this post:
1. MAIN_POST - Best overall optimization with improved hook and structure
2. ALT_HOOK - Same content, completely different opening hook style
3. ALT_STRUCTURE - Same message, different structure (if narrative, make direct; if listy, make flowing)
4. ALT_SHORT - Condensed punchy version (50-70% length)

Maintain the original voice and message.
Learn structure and hook patterns from the viral posts.
NEVER use both Tal and Grapevine in the same post.
NEVER use em dashes.`;

    const fullPrompt = `${LINKEDIN_OPTIMIZER_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

    console.log(`[linkedin-optimizer] Calling Gemini...`);

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text() || '';

    // Parse response
    const parsed = parseOptimizerResponse(responseText);

    // Post-process: Remove any em dashes that slipped through
    parsed.mainPost = removeEmDashes(parsed.mainPost);
    parsed.altHook = removeEmDashes(parsed.altHook);
    parsed.altStructure = removeEmDashes(parsed.altStructure);
    parsed.altShort = removeEmDashes(parsed.altShort);

    console.log(`[linkedin-optimizer] Generated ${Object.keys(parsed).filter(k => parsed[k as keyof typeof parsed]).length} versions`);

    return {
      username,
      mainPost: parsed.mainPost || rawPost,
      altHook: parsed.altHook || '',
      altStructure: parsed.altStructure || '',
      altShort: parsed.altShort || '',
      optimizationNotes: parsed.optimizationNotes || '',
      originalPost: rawPost,
    };
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function safeJoin(value: any, separator: string = ", "): string {
  if (!value) return "None";
  if (Array.isArray(value)) return value.join(separator);
  if (typeof value === "string") return value;
  return String(value);
}

function removeEmDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s—\s/g, '. ')
    .replace(/—/g, ', ')
    .replace(/\.\s+\./g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptimizerResponse(text: string): {
  mainPost: string;
  altHook: string;
  altStructure: string;
  altShort: string;
  optimizationNotes: string;
} {
  const result = {
    mainPost: '',
    altHook: '',
    altStructure: '',
    altShort: '',
    optimizationNotes: '',
  };

  // Parse MAIN_POST
  const mainMatch = text.match(/MAIN_POST:\s*([\s\S]*?)(?=\n\s*ALT_HOOK:|$)/i);
  if (mainMatch) {
    result.mainPost = mainMatch[1].trim();
  }

  // Parse ALT_HOOK
  const hookMatch = text.match(/ALT_HOOK:\s*([\s\S]*?)(?=\n\s*ALT_STRUCTURE:|$)/i);
  if (hookMatch) {
    result.altHook = hookMatch[1].trim();
  }

  // Parse ALT_STRUCTURE
  const structMatch = text.match(/ALT_STRUCTURE:\s*([\s\S]*?)(?=\n\s*ALT_SHORT:|$)/i);
  if (structMatch) {
    result.altStructure = structMatch[1].trim();
  }

  // Parse ALT_SHORT
  const shortMatch = text.match(/ALT_SHORT:\s*([\s\S]*?)(?=\n\s*OPTIMIZATION_NOTES:|$)/i);
  if (shortMatch) {
    result.altShort = shortMatch[1].trim();
  }

  // Parse OPTIMIZATION_NOTES
  const notesMatch = text.match(/OPTIMIZATION_NOTES:\s*([\s\S]*?)$/i);
  if (notesMatch) {
    result.optimizationNotes = notesMatch[1].trim();
  }

  return result;
}

export default linkedinOptimizerTool;
