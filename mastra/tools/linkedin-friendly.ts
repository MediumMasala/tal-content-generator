import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { loadPersonality } from "../storage/local-storage";

// ============================================
// TOOL INPUT SCHEMA
// ============================================

export const LinkedInFriendlyInputSchema = z.object({
  // The username to load personality for
  username: z.string(),

  // The generated post from linkedin-post-generator
  generatedPost: z.string(),

  // The alt version (optional)
  altVersion: z.string().optional(),

  // Image recommendation output (optional)
  imageRecommendation: z.object({
    recommendedChat: z.object({
      filename: z.string(),
      userName: z.string(),
    }).optional(),
    screenshotRange: z.object({
      suggestedMessages: z.array(z.any()),
    }).optional(),
  }).optional(),

  // Path to CSV with viral/top posts (optional - will use default if not provided)
  viralPostsCsvPath: z.string().optional(),
});

export type LinkedInFriendlyInput = z.infer<typeof LinkedInFriendlyInputSchema>;

// ============================================
// TOOL OUTPUT SCHEMA
// ============================================

export const LinkedInFriendlyOutputSchema = z.object({
  // The optimized viral-style post
  optimizedPost: z.string(),

  // Alternative version
  altOptimizedPost: z.string(),

  // What viral structure was used
  structureUsed: z.string(),

  // How personality was preserved
  personalityNotes: z.string(),

  // Original post for comparison
  originalPost: z.string(),

  // Confidence score
  confidenceScore: z.number(),

  // Variants with hook types (for display purposes)
  variants: z.array(z.object({
    hookType: z.string(),
    post: z.string(),
    whyItWorks: z.string(),
  })).optional(),
});

export type LinkedInFriendlyOutput = z.infer<typeof LinkedInFriendlyOutputSchema>;

// ============================================
// LOAD VIRAL POSTS FROM CSV
// ============================================

function loadViralPostsFromCsv(csvPath: string): string[] {
  try {
    const content = fs.readFileSync(csvPath, "utf-8");
    const lines = content.split("\n");

    // Skip header row, extract post content
    // Assuming CSV format: some columns with post content in one of them
    const posts: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        // Try to extract post content - handle quoted CSV fields
        // This is a simple parser - for complex CSVs, use a library
        const match = line.match(/"([^"]+)"/);
        if (match) {
          posts.push(match[1]);
        } else {
          // If no quotes, take the whole line or first substantial column
          const parts = line.split(",");
          const postContent = parts.find(p => p.length > 50);
          if (postContent) {
            posts.push(postContent.trim());
          }
        }
      }
    }

    return posts;
  } catch (error) {
    console.error("[linkedin-friendly] Error loading CSV:", error);
    return [];
  }
}

// ============================================
// DEFAULT VIRAL POST STRUCTURES
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
// SYSTEM PROMPT
// ============================================

const LINKEDIN_FRIENDLY_SYSTEM_PROMPT = `You are an expert at optimizing LinkedIn posts for engagement while maintaining authentic voice.

You will receive:
1. A person's personality profile (their traits, values, writing style)
2. A generated LinkedIn post about a career agent (already written in their voice)
3. Examples of viral/top-performing LinkedIn posts OR viral structure patterns
4. Optionally, an image/screenshot recommendation

Your task is to create TWO versions of the post that:
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
   The two versions MUST use DIFFERENT hook styles. Choose from:

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
   - The two versions should feel meaningfully different

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

7. HUMAN CONSEQUENCE
   - Focus on what the product DOES for the person, not what it IS
   - Translate features into human outcomes
   - Avoid mechanic-heavy explanations

OUTPUT FORMAT:

Return exactly in this structure:

OPTIMIZED POST:
[the viral-optimized version]

ALT OPTIMIZED:
[a second version using a DIFFERENT viral structure - not the same hook type]

STRUCTURE USED:
[name BOTH hook types used: "Main: [type], Alt: [type]" and briefly explain why each fits]

PERSONALITY PRESERVED:
[how you maintained their authentic voice]`;

// ============================================
// MAIN FUNCTION
// ============================================

export async function generateLinkedInFriendly(
  input: LinkedInFriendlyInput
): Promise<LinkedInFriendlyOutput> {
  console.log(`[linkedin-friendly] Optimizing post for ${input.username}`);

  // Load personality
  const personality = loadPersonality(input.username);
  if (!personality) {
    throw new Error(`Personality not found for ${input.username}`);
  }

  // Load viral posts from CSV if provided, otherwise use default structures
  let viralContext = DEFAULT_VIRAL_STRUCTURES;

  if (input.viralPostsCsvPath && fs.existsSync(input.viralPostsCsvPath)) {
    const viralPosts = loadViralPostsFromCsv(input.viralPostsCsvPath);
    if (viralPosts.length > 0) {
      console.log(`[linkedin-friendly] Loaded ${viralPosts.length} viral posts from CSV`);
      viralContext = `## VIRAL POST EXAMPLES (analyze structure, hooks, and patterns)\n\n`;
      viralPosts.slice(0, 15).forEach((post, i) => {
        viralContext += `### Example ${i + 1}:\n${post}\n\n---\n\n`;
      });
    }
  }

  // Build personality context
  const personalityContext = `
## PERSON'S PERSONALITY PROFILE

Name: ${personality.username}

### Profile Snapshot:
${JSON.stringify(personality.profileSnapshot || {}, null, 2)}

### Personality Traits:
${JSON.stringify(personality.personalityGraph || {}, null, 2)}

### Writing Style:
${JSON.stringify(personality.autoWritingGraph || {}, null, 2)}
`;

  // Build image context if available
  let imageContext = "";
  if (input.imageRecommendation?.screenshotRange?.suggestedMessages) {
    imageContext = `
## ACCOMPANYING IMAGE (Tal chat screenshot)
The post will be accompanied by this Tal conversation screenshot:
${input.imageRecommendation.screenshotRange.suggestedMessages.map((m: any) =>
  `${m.role}: ${m.content}`
).join("\n")}
`;
  }

  // Build user prompt
  const userPrompt = `
${personalityContext}

## ORIGINAL GENERATED POST (to optimize)
${input.generatedPost}

${input.altVersion ? `## ORIGINAL ALT VERSION\n${input.altVersion}` : ""}

${imageContext}

## VIRAL POST PATTERNS & EXAMPLES
${viralContext}

## TASK
Create an optimized version of this post using viral LinkedIn structures while preserving this person's authentic voice.
`;

  // Call Gemini
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",  // Always use 2.5 Pro for writing
    generationConfig: {
      temperature: 0.7,
    },
  });

  console.log("[linkedin-friendly] Calling Gemini...");

  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: LINKEDIN_FRIENDLY_SYSTEM_PROMPT + "\n\n" + userPrompt }] },
    ],
  });

  const responseText = result.response.text();
  console.log("[linkedin-friendly] Got response, parsing JSON...");

  let variants: { hookType: string; post: string; whyItWorks: string }[] = [];
  let personalityNotes = "";

  // Try to parse as JSON first
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    if (parsed.variants && Array.isArray(parsed.variants)) {
      variants = parsed.variants.map((v: any) => ({
        hookType: v.hookType || "Unknown",
        post: v.post || "",
        whyItWorks: `${v.hookType} hook style`,
      }));
      personalityNotes = parsed.personalityNotes || "";
    }
  } catch (e) {
    console.log("[linkedin-friendly] JSON parse failed, trying text format...");

    // Fallback: try VARIANT format
    const variantRegex = /VARIANT\s*(\d+)\s*\[([^\]]+)\]:\s*([\s\S]*?)(?=VARIANT\s*\d+\s*\[|PERSONALITY PRESERVED:|$)/gi;
    let match;

    while ((match = variantRegex.exec(responseText)) !== null) {
      variants.push({
        hookType: match[2].trim(),
        post: match[3].trim(),
        whyItWorks: `${match[2].trim()} hook style`,
      });
    }

    // Fallback: try old OPTIMIZED POST format
    if (variants.length === 0) {
      const optimizedPostMatch = responseText.match(/OPTIMIZED POST:\s*([\s\S]*?)(?=ALT OPTIMIZED:|$)/i);
      const altOptimizedMatch = responseText.match(/ALT OPTIMIZED:\s*([\s\S]*?)(?=STRUCTURE USED:|$)/i);

      if (optimizedPostMatch) {
        variants.push({
          hookType: "Primary",
          post: optimizedPostMatch[1].trim(),
          whyItWorks: "Main optimized version",
        });
      }
      if (altOptimizedMatch) {
        variants.push({
          hookType: "Alternative",
          post: altOptimizedMatch[1].trim(),
          whyItWorks: "Alternative version",
        });
      }
    }

    const personalityMatch = responseText.match(/PERSONALITY PRESERVED:\s*([\s\S]*?)$/i);
    personalityNotes = personalityMatch?.[1]?.trim() || "";
  }

  console.log(`[linkedin-friendly] Extracted ${variants.length} variants`);

  // Build legacy fields for backwards compatibility
  const optimizedPost = variants[0]?.post || input.generatedPost;
  const altOptimizedPost = variants[1]?.post || input.altVersion || "";
  const structureUsed = variants.map(v => v.hookType).join(", ");

  return {
    variants,
    optimizedPost,
    altOptimizedPost,
    structureUsed,
    personalityNotes,
    originalPost: input.generatedPost,
    confidenceScore: 75,
  };
}

// ============================================
// EXPORT FOR WORKFLOW
// ============================================

export const linkedInFriendlyTool = {
  id: "linkedin-friendly",
  description: "Optimizes LinkedIn posts using viral structures while preserving authentic voice",
  inputSchema: LinkedInFriendlyInputSchema,
  outputSchema: LinkedInFriendlyOutputSchema,
  execute: generateLinkedInFriendly,
};
