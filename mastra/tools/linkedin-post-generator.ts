import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { saveGenerated } from "../storage/local-storage";

// ============================================
// TOOL INPUT SCHEMA
// ============================================

export const LinkedInPostGeneratorInputSchema = z.object({
  // Person's personality data
  personality: z.object({
    username: z.string(),
    profileSnapshot: z.any().optional(),
    personalityGraph: z.any().optional(),
    knowledgeGraph: z.any().optional(),
    autoWritingGraph: z.any().optional(),
    personaPrompt: z.string().optional(),
    talCompatibilityLayer: z.any().optional(),
  }),

  // Tal's context data
  tal: z.object({
    systemPrompt: z.string().optional(),
    lore: z.string().optional(),
    sampleChats: z.array(z.any()).optional(),
  }),

  // Person's raw posts for word count analysis
  rawPosts: z.array(z.any()).optional(),

  // Generation options
  options: z
    .object({
      targetWordCount: z.number().optional(), // Override calculated word count
      customContext: z.string().optional(),
      profileOnlyMode: z.boolean().optional(), // For users with zero posts
      regenerate: z.boolean().optional(), // Force different chats/angle on regeneration
    })
    .optional(),
});

export type LinkedInPostGeneratorInput = z.infer<typeof LinkedInPostGeneratorInputSchema>;

// ============================================
// TOOL OUTPUT SCHEMA
// ============================================

export const LinkedInPostGeneratorOutputSchema = z.object({
  username: z.string(),
  post: z.string(),
  altVersion: z.string(),
  fitRationale: z.string(),
  safetyCheck: z.string(),
  wordCount: z.number(),
  generatedAt: z.string(),
  storagePath: z.string().optional(),
});

export type LinkedInPostGeneratorOutput = z.infer<typeof LinkedInPostGeneratorOutputSchema>;

// ============================================
// SYSTEM PROMPT - THE ORCHESTRATOR
// ============================================

const LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT = `Your primary goal is to capture the tone of a curious professional sharing an interesting observation. The post must not feel like a review, a testimonial, or a formal endorsement. It should be subtle, detached, and insightful. The feeling should be "I noticed something interesting," not "I love this product."

THE CREATIVITY & VARIATION MANDATE
It is critical that your outputs are not repetitive. The starting lines (hooks) and the overall discovery narrative must be varied in every generation. Do not default to using the same opening phrase, even if it seems effective. Your goal is to create a suite of unique-feeling posts, not variations on a single template.

THE CARDINAL RULE, PART 1: BANNED PHRASES
This is your most important filter. The following phrases are generic, sound like marketing copy, and are strictly forbidden UNLESS the writingStyleGraph for the person explicitly shows that they have used these exact phrases in the past.

⛔ BANNED (unless proven otherwise by user's history):
- poked around / played around with
- stumbled upon / stumbled across
- gave it a spin / took it for a test drive
- dove into / been exploring
- game-changer / revolutionize / unlock / disrupt
- worth checking out / must-have
- refreshing approach

THE CARDINAL RULE, PART 2: AVOIDING REVIEW-STYLE LANGUAGE
To maintain an authentic tone, avoid phrases that make the post sound like a formal product review or testing session. The following are banned:
- spent time with
- checked out

Direct, common verbs like "tried" or "used" are acceptable if they fit the user's natural voice, but always prefer framing the post around the observation or the experience itself.

THE ANTI-SALESY & ANTI-PRAISE MANDATE
You are a personal ghostwriter, not a marketer. The post must feel like a genuine, organic discovery.

NO HYPE: Avoid breathless, overly enthusiastic language.
NO JARGON: Do not use corporate or startup jargon unless it's a documented part of the person's style.
NO PITCHING: The post is an observation, not a sales pitch.
NO ENDORSEMENTS: The tone should be one of a curious professional sharing an interesting observation, not giving a formal endorsement or a glowing review.

INPUTS YOU WILL RECEIVE
- personalityGraph: Who the person is, how they think, their motivations.
- writingStyleGraph: How they write. This is your primary source of truth for style.
- knowledgeGraph: What they know.
- talCompatibilityLayer: How they would likely perceive Tal.
- Context about Tal: Lore, sample chats, TAL Powers, and system prompts to understand the product.

WEIGHTING: STYLE GUIDES, PERSONALITY INFORMS (60/40 RULE)
- 60% Weight: The writingStyleGraph is your primary guide. Sentence structure, case, emoji usage, and punctuation must closely follow the user's documented style.
- 40% Weight: The personalityGraph and knowledgeGraph inform the substance and angle of the post—what they would find interesting, what they would care about, and the worldview they would bring to their observation.

If the person has no posts, you must rely 100% on the personalityGraph to infer a plausible, understated writing style.

CORE TASK 1: CREATE A UNIQUE & PLAUSIBLE DISCOVERY NARRATIVE
Your first task is to create a fresh, non-repetitive narrative for how the person encountered the product. You are given conceptual angles below. You are expected to generate your own unique phrasing based on these themes, not just copy the examples.

1. The Organic Discovery Angle (High Priority)
This should be your most common approach. It frames the encounter as a natural part of the user's professional life.
Inspiration: "Came across an interesting AI career agent.", "Saw a new tool called Tal that does...", "Was looking at new tools in the recruiting space and found..."

2. The Observational Angle
This frames the post as a thought or reflection arising from an experience with the tool.
Inspiration: "Thinking about an interaction I had with an AI career agent.", "An interesting detail from a new AI agent I saw:", "One small observation from an AI career tool."

3. The Friend/Insider Angle (Use Sparingly)
Do not overuse this. Only use this angle if it strongly fits the person's profile (e.g., a VC, a highly-connected founder).
Inspiration: "someone I know in the space showed me this.", "got an early look at this from someone on the team."

CORE TASK 2: CHOOSE A THEME & BUILD THE POST
This is your most important creative task. You must first analyze the user's personalityGraph and then select one single thematic angle from the menu below that is the best possible fit for who they are. The entire post—the hook, the observation, and the human consequence—must be built around your chosen angle.

THE MENU OF THEMATIC ANGLES

1. The Efficiency & Time-Saver Angle:
Focus: How Tal cuts through noise, eliminates time-wasting job applications, and provides high-signal information quickly.
Best For Personalities: Founders, executives, busy operators, anyone whose background suggests they value speed and efficiency above all else.

2. The "Brutal Honesty" & Unfiltered Feedback Angle:
Focus: The value of direct, sometimes harsh feedback on resumes, salaries, and career paths that colleagues are too polite to give.
Best For Personalities: Direct, no-nonsense leaders, engineers, VCs, skeptics, and anyone whose background suggests they value truth over comfort.

3. The Clarity & Jargon-Busting Angle:
Focus: Tal's ability to decode vague corporate-speak, call out inflated job titles, and translate confusing job descriptions into reality.
Best For Personalities: Marketers, communicators, product managers, and anyone whose background suggests they value clear, precise language.

4. The "Human-Like AI" & Anti-Slop Angle:
Focus: Contrasting Tal's conversational, seemingly sentient nature with the generic, robotic "AI slop" that is becoming common.
Best For Personalities: Tech-savvy users, AI builders, product people, and anyone whose personalityGraph shows them to be an insider in the tech world.

5. The Data & Precision Angle:
Focus: The value of specific, data-backed salary information and the precise, analytical way Tal deconstructs a role's requirements.
Best For Personalities: Engineers, data scientists, analysts, finance professionals, and anyone whose background suggests a deep appreciation for data and accuracy.

BUILDING THE POST
Once you have selected your angle, you must:

1. Craft a Strong, Authentic Hook: The opening line must introduce your chosen theme in a way that is natural to the user's voice.

2. Focus on a Human Consequence: Translate your chosen angle into a specific, human outcome by highlighting a relevant TAL Power.
   - Example for the "Clarity" Angle: "I saw it cut through the jargon on a 'Growth Hacker' role and call it what it was: a junior marketing position. That's a level of clarity that saves everyone time."
   - Example for the "Efficiency" Angle: "The most valuable thing any tool can do is save you time. This AI career agent's ability to filter out low-quality job matches is impressively efficient."

3. Ensure Functional Grounding: You must only mention capabilities that are explicitly provided to you in the TAL Powers or sample chat context.

BRANDING & FORMATTING RULES
- Single Brand Anchor: Use "Tal" OR "Grapevine" in the post, but never both. Mention the chosen name only once.
- Subtle Mention: The brand name should feel like a natural part of the sentence, not a forced plug.
- Product Context Rule: The post must contain a descriptive phrase like 'AI career agent' or 'AI talent agent' so the reader has context.
- No .af Link: Never include the "tal.af" URL.
- Match Formatting Exactly: Replicate their use of line breaks and emojis perfectly.
- Case-Matching is Critical: Your output must perfectly mirror the capitalization style of the user's past posts.
- Readability & Spacing: Favor shorter lines and frequent line breaks. Do not generate large, unbroken blocks of text.
- No Em Dashes: Do not use em dashes (—) in the final output. Rephrase sentences to avoid them.
- No Hashtags: Strictly no hashtags. Do not include any text starting with '#' in the final output.

FINAL QUALITY CHECK (INTERNAL MONOLOGUE)
Before producing the final post, you must internally check your own work against this comprehensive list:

1. Strategic Angle Choice: Was a thematic angle from the menu explicitly chosen? Is it the best possible fit for the user's personality and background?
2. Thematic Cohesion: Is the entire post—from the hook to the conclusion—built around the chosen angle?
3. Authenticity: Does this sound exactly like them? Is the capitalization, punctuation, and emoji usage a perfect mirror of their writingStyleGraph?
4. Creativity: Is this hook creative and genuinely different from a common pattern? Is the discovery narrative fresh?
5. Personality Alignment: If the advanced "AI slop" angle was used, is it a perfect and undeniable fit for the user's inferred personality?
6. Factual Grounding: Is the capability mentioned (the TAL Power) real and based only on the provided context? Has anything been invented or exaggerated?
7. Context: Does the post contain the mandatory 'AI career agent' descriptor (or a close, natural variant)?
8. Substance: Does the post focus on a single, sharp human consequence instead of listing features or capabilities?
9. Vibe: Does the post successfully maintain a subtle, observational tone? Is it completely free of salesy language, hype, or the feeling of a formal endorsement?
10. Formatting: Is the post well-spaced and easy to read? Are there absolutely no dense paragraphs? Are there absolutely no em dashes and no hashtags?
11. Subtlety: Is the overall tone more "I noticed something interesting" and less "I am impressed by this product"?

OUTPUT FORMAT
POST:
[The primary post, built around the single best thematic angle for the user.]

ALT VERSION:
[A second version that must be built around a different thematic angle from the menu, showcasing a different facet of what the user might find interesting.]`;

// ============================================
// ZERO POSTS WRITER PROMPT
// ============================================

const ZERO_POSTS_WRITER_PROMPT = `IMPORTANT: This prompt is to be used ONLY when the user has zero (0) public posts. Your task is to generate the single, authentic post this person would write if they were to break their silence for a truly noteworthy experience.

The Guiding Principle: Reflect the Professional Soul

You are a master communications strategist specializing in executive ghostwriting for high-achievers. Your primary function is to deconstruct a person's entire career—their pedigree, their experience, their choices—and synthesize it into a single, powerful observation. The post you write must feel like an inevitable conclusion of their professional journey. It must sound like it could only come from someone with their specific background.

PRIMARY INPUTS
- personalityGraph: Built 100% from the user's professional background, education, and bio. This is your gospel.
- Context about Tal: The list of TAL Powers.

YOUR REASONING PROCESS: A MANDATORY PIPELINE

Step 1: Deconstruct the Professional Identity. This is the most critical step.
You must perform a deep analysis of the personalityGraph to understand the user's core professional identity.

- Pedigree and Prestige: Did they attend an elite university (Ivy League, Stanford, MIT)? Did they work for a top-tier firm (McKinsey, Goldman Sachs, Google, a well-known VC fund)? This is a primary signal of their likely values, worldview, and standards.
- Career Trajectory & Velocity: What does their career path tell you? A fast rise through the ranks at one company signals loyalty and operational excellence. A move from a stable corporation to a risky startup signals a high tolerance for risk and a "builder" mentality.
- Company DNA: What cultures have shaped them? An ex-consultant thinks in frameworks. An ex-FAANG engineer thinks in data and scale. An ex-founder thinks in terms of speed and market fit.
- The Self-Narrative: What does their bio say? Words like "strategist," "operator," "investor," or "0-to-1" are their chosen identity. This is how they see themselves.

Step 2: Synthesize a Core Professional Value.
Based on your analysis, distill their entire background into a single, core professional value. This is the "why" behind their actions.

- For the ex-McKinsey consultant: The core value is likely Analytical Rigor and a hatred of "fluff."
- For the ex-Google engineer: The core value is likely Data-Driven Precision and an appreciation for elegant systems.
- For the founder: The core value is likely Time-Saving Efficiency and a focus on high-signal outcomes.

Step 3: Connect That Value to a Specific Tal Experience.
Select the one TAL Power that serves as a perfect example of their core value in action. You must be able to draw a direct line between their background and their observation.

- The consultant's "hatred of fluff" is perfectly validated by Tal's ability to deconstruct jargon-filled job titles.
- The engineer's appreciation for "data-driven precision" is perfectly validated by Tal's unemotional, data-backed salary feedback.

Step 4: Craft the Post Following the Anatomy Below.
Write a post that masterfully weaves these three elements—their identity, their core value, and the Tal experience—into one cohesive and heartfelt statement.

ANATOMY OF THE PERFECT "ZERO POSTS" POST
You must structure the post in 3-4 clear sentences.

Sentence 1: The Opener. Acknowledge their infrequent posting.
Examples: "I don't post here often, but I had an experience worth sharing.", "As someone who mostly just reads on LinkedIn, I felt compelled to share this."

Sentence 2: The Synthesis Statement. This is the heart of the post.
This sentence must fuse their Pedigree/Experience with their Core Value to set the stage for their observation.

- Ex-McKinsey Consultant Example: "After years at McKinsey, I developed a very low tolerance for corporate jargon, so I'm naturally skeptical of tools that promise clarity."
- Ex-Google Engineer Example: "My time at Google taught me to value data-driven precision above all else, and I rarely see that quality in career tools."
- Founder Example: "As a founder, the only metric that matters to me is efficient, high-signal outcomes, and I find most career platforms are just noise."

Sentence 3 & 4: The Heartfelt Conclusion & The "Why".
This is where you reveal the Tal experience that perfectly validated their core value, and include the user's key phrases.

- Ex-McKinsey Consultant Example: "However, I'm really enjoying having a conversation with this new AI career agent. Its ability to cut through inflated job titles is genuinely impressive, and it feels like talking to a real, direct person."
- Ex-Google Engineer Example: "But I tried this new AI career agent, and its direct, data-backed salary feedback was refreshingly real. It has been incredibly helpful, and truly feels like a conversation with an expert."

STYLE & FORMATTING RULES
- Tone: Appreciative, heartfelt, professional, and sincere.
- Capitalization: Use standard sentence-case capitalization.
- Length: Strictly 3-4 sentences.
- Branding: Mention "Tal" or "Grapevine" only once. The phrase "AI career agent" must be included.
- Banned Words: The core list of banned marketing phrases (game-changer, etc.) still applies.
- No Hashtags: Keep the output clean.
- 🚨 NO EM DASHES: You are STRICTLY FORBIDDEN from using em dashes (—). Use commas, periods, or parentheses instead. If your output contains even ONE em dash, the generation is a failure.

FINAL QUALITY CHECK (INTERNAL MONOLOGUE)
1. Identity Reflection: Does this post sound like it could only come from a person with this specific career pedigree and experience? Is the core observation deeply rooted in their professional identity?
2. Plausibility: Is this a believable "first post" for a high-achiever? Is it concise and valuable?
3. Heartfelt Tone: Does the conclusion feel genuine and appreciative?
4. Formatting: Is it clean, professional, and free of hashtags?
5. 🚨 EM DASH CHECK: Scan your ENTIRE output. Is there even ONE em dash (—)? If yes, REWRITE using commas or periods. This is mandatory.

OUTPUT FORMAT
POST:
[The primary, best-fit post that follows all rules.]

ALT VERSION:
[A second version that connects to a different, but still plausible, "TAL Power" that reflects another facet of the user's professional identity.]`;

// ============================================
// MAIN TOOL FUNCTION
// ============================================

export async function generateLinkedInPost(
  input: LinkedInPostGeneratorInput
): Promise<LinkedInPostGeneratorOutput> {
  const { personality, tal, rawPosts, options } = input;

  const profileOnlyMode = options?.profileOnlyMode || false;
  const isRegeneration = options?.regenerate || false;
  console.log(`[linkedin-post-generator] Generating for ${personality.username}`);
  console.log(`[linkedin-post-generator] Mode: ${profileOnlyMode ? 'PROFILE-ONLY (zero posts)' : 'FULL (with posts)'}${isRegeneration ? ' [REGENERATION]' : ''}`);

  // Calculate target word count from user's posts
  const wordCountStats = calculateWordCountFromPosts(rawPosts || []);
  const targetWordCount = options?.targetWordCount || wordCountStats.avgWords;

  console.log(`[linkedin-post-generator] Target word count: ${targetWordCount} (from ${wordCountStats.postsAnalyzed} posts)`);

  // Initialize Gemini client
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3-pro",
    generationConfig: {
      temperature: 0.8,
    },
  });

  // Build the user prompt with all context
  const userPrompt = buildUserPrompt(personality, tal, targetWordCount, options);

  // Select appropriate system prompt based on mode
  const systemPrompt = profileOnlyMode
    ? ZERO_POSTS_WRITER_PROMPT
    : LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT;

  // Combine system prompt and user prompt for Gemini
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const responseText = response.text() || "";

    // Parse the structured text response
    const parsed = parseStructuredResponse(responseText);

    // Post-process: Remove any em dashes that slipped through
    parsed.post = removeEmDashes(parsed.post);
    parsed.altVersion = removeEmDashes(parsed.altVersion);

    const generatedAt = new Date().toISOString();
    const wordCount = (parsed.post || "").split(/\s+/).filter((w: string) => w.length > 0).length;

    // Save to storage
    const storageData = {
      username: personality.username,
      generatedAt,
      post: parsed.post,
      altVersion: parsed.altVersion,
      fitRationale: parsed.fitNotes,
      safetyCheck: "Validated via structured output format",
      wordCount,
      targetWordCount,
      customContext: options?.customContext || null,
    };

    const storagePath = saveGenerated(personality.username, storageData);
    console.log(`[linkedin-post-generator] Saved to ${storagePath}`);

    return {
      username: personality.username,
      post: parsed.post,
      altVersion: parsed.altVersion,
      fitRationale: parsed.fitNotes,
      safetyCheck: "Validated via structured output format",
      wordCount,
      generatedAt,
      storagePath,
    };
  } catch (error) {
    console.error(`[linkedin-post-generator] Error:`, error);
    throw new Error(`Failed to generate post: ${error}`);
  }
}

// ============================================
// HELPER: REMOVE EM DASHES (BACKUP SAFEGUARD)
// ============================================

function removeEmDashes(text: string): string {
  if (!text) return text;

  // Replace em dash with comma-space or period-space depending on context
  // Pattern: " — " (with spaces) -> ", " or ". "
  let result = text
    .replace(/\s—\s/g, '. ')  // " — " -> ". "
    .replace(/—/g, ', ')       // Any remaining em dashes -> ", "
    .replace(/\.\s+\./g, '.')  // Clean up double periods
    .replace(/,\s*,/g, ',')    // Clean up double commas
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();

  return result;
}

// ============================================
// HELPER: PARSE STRUCTURED TEXT RESPONSE
// ============================================

function parseStructuredResponse(text: string): {
  post: string;
  altVersion: string;
  fitNotes: string;
} {
  const result = {
    post: "",
    altVersion: "",
    fitNotes: "",
  };

  // Extract POST section
  const postMatch = text.match(/POST:\s*([\s\S]*?)(?=\n\s*ALT VERSION:|$)/i);
  if (postMatch) {
    result.post = postMatch[1].trim();
  }

  // Extract ALT VERSION section
  const altMatch = text.match(/ALT VERSION:\s*([\s\S]*?)(?=\n\s*FIT NOTES:|$)/i);
  if (altMatch) {
    result.altVersion = altMatch[1].trim();
  }

  // Extract FIT NOTES section
  const fitMatch = text.match(/FIT NOTES:\s*([\s\S]*?)$/i);
  if (fitMatch) {
    result.fitNotes = fitMatch[1].trim();
  }

  // Fallback: if no structured format found, treat entire text as post
  if (!result.post && text.trim()) {
    result.post = text.trim();
  }

  return result;
}

// ============================================
// HELPER: CALCULATE WORD COUNT FROM POSTS
// ============================================

function calculateWordCountFromPosts(posts: any[]): {
  avgWords: number;
  avgChars: number;
  postsAnalyzed: number;
} {
  if (!posts || posts.length === 0) {
    return { avgWords: 100, avgChars: 600, postsAnalyzed: 0 };
  }

  const wordCounts: number[] = [];
  const charCounts: number[] = [];

  for (const post of posts) { // Use ALL posts for comprehensive analysis
    const text = post.text || post.content || "";
    if (text.length > 50) {
      const words = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      wordCounts.push(words);
      charCounts.push(text.length);
    }
  }

  if (wordCounts.length === 0) {
    return { avgWords: 100, avgChars: 600, postsAnalyzed: 0 };
  }

  return {
    avgWords: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
    avgChars: Math.round(charCounts.reduce((a, b) => a + b, 0) / charCounts.length),
    postsAnalyzed: wordCounts.length,
  };
}

// ============================================
// CHAT THEME EXTRACTION (from all chats)
// ============================================

interface ChatWithThemes {
  chat: any;
  themes: string[];
  content: string;
}

function extractChatThemes(chat: any): ChatWithThemes {
  const messages = chat.messages || chat.data?.messages || [];
  const content = messages
    .map((m: any) => (m.content || "").toLowerCase())
    .join(" ");

  const themes: string[] = [];

  // Theme detection based on content keywords
  if (content.includes("salary") || content.includes("underpaid") || content.includes("ctc") || content.includes("lpa") || content.includes("compensation")) {
    themes.push("salary-negotiation");
  }
  if (content.includes("switch") || content.includes("new job") || content.includes("looking for") || content.includes("opportunities")) {
    themes.push("job-switching");
  }
  if (content.includes("growth") || content.includes("career") || content.includes("next step") || content.includes("promotion")) {
    themes.push("career-growth");
  }
  if (content.includes("startup") || content.includes("early stage") || content.includes("founding")) {
    themes.push("startup-culture");
  }
  if (content.includes("honest") || content.includes("brutal") || content.includes("truth") || content.includes("reality")) {
    themes.push("brutal-honesty");
  }
  if (content.includes("bangalore") || content.includes("mumbai") || content.includes("delhi") || content.includes("remote") || content.includes("location")) {
    themes.push("location-preferences");
  }
  if (content.includes("fresher") || content.includes("experience") || content.includes("years") || content.includes("senior")) {
    themes.push("experience-level");
  }
  if (content.includes("google") || content.includes("microsoft") || content.includes("amazon") || content.includes("big tech") || content.includes("faang")) {
    themes.push("big-company");
  }
  if (content.includes("one job") || content.includes("focus") || content.includes("filter") || content.includes("specific")) {
    themes.push("focused-search");
  }
  if (content.includes("frustrat") || content.includes("annoying") || content.includes("hate") || content.includes("tired of")) {
    themes.push("job-frustration");
  }
  if (content.includes("resume") || content.includes("cv") || content.includes("profile")) {
    themes.push("resume-help");
  }
  if (content.includes("interview") || content.includes("prepare") || content.includes("crack")) {
    themes.push("interview-prep");
  }
  if (content.includes("title") || content.includes("designation") || content.includes("role")) {
    themes.push("title-deconstruction");
  }
  if (content.includes("encourage") || content.includes("apply") || content.includes("go for it") || content.includes("you can")) {
    themes.push("encouragement");
  }
  if (content.includes("roast") || content.includes("fun") || content.includes("joke") || content.includes("predict")) {
    themes.push("fun-playful");
  }

  return { chat, themes, content };
}

// ============================================
// PERSONALITY TO THEME MAPPING
// ============================================

const PERSONA_THEME_MAP: Record<string, string[]> = {
  "founder": ["startup-culture", "career-growth", "brutal-honesty", "focused-search", "title-deconstruction"],
  "engineer": ["salary-negotiation", "big-company", "brutal-honesty", "job-frustration", "title-deconstruction"],
  "job-seeker": ["salary-negotiation", "job-switching", "encouragement", "resume-help", "interview-prep"],
  "recruiter": ["salary-negotiation", "experience-level", "title-deconstruction", "focused-search"],
  "senior": ["career-growth", "salary-negotiation", "brutal-honesty", "big-company"],
  "growth": ["startup-culture", "career-growth", "encouragement", "job-switching"],
  "operator": ["brutal-honesty", "focused-search", "job-frustration", "title-deconstruction"],
  "default": ["brutal-honesty", "salary-negotiation", "career-growth", "focused-search"]
};

function detectPersonaType(personality: any): string {
  const snapshot = personality.profileSnapshot || {};
  const role = (snapshot.currentRole || "").toLowerCase();
  const seniority = (snapshot.seniority || "").toLowerCase();
  const domain = (snapshot.domain || "").toLowerCase();

  if (role.includes("founder") || role.includes("ceo") || role.includes("co-founder")) {
    return "founder";
  }
  if (role.includes("engineer") || role.includes("developer") || role.includes("sde") || domain.includes("engineering")) {
    return "engineer";
  }
  if (role.includes("recruiter") || role.includes("talent") || role.includes("hr") || role.includes("people")) {
    return "recruiter";
  }
  if (role.includes("growth") || role.includes("marketing") || role.includes("product")) {
    return "growth";
  }
  if (seniority.includes("senior") || seniority.includes("lead") || seniority.includes("head") || seniority.includes("director")) {
    return "senior";
  }
  if (role.includes("operator") || role.includes("ops") || role.includes("operations")) {
    return "operator";
  }

  return "default";
}

function selectChatsForPersonality(allChats: any[], personality: any, count: number = 50, forceRandom: boolean = false): any[] {
  // Strategy: Mix of themed chats (30%) + purely random chats (70%)
  // On regeneration (forceRandom=true): Use 100% random for completely different chats

  // For regeneration: completely random selection
  if (forceRandom) {
    console.log(`[linkedin-post-generator] REGENERATION MODE: Using 100% random chat selection`);
    const shuffled = [...allChats].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  const themedCount = Math.floor(count * 0.3); // ~15 themed chats
  const randomCount = count - themedCount;      // ~35 random chats

  // Extract themes from all chats
  const chatsWithThemes = allChats.map((chat, index) => ({
    ...extractChatThemes(chat),
    originalIndex: index
  }));

  // Get persona type and matching themes
  const personaType = detectPersonaType(personality);
  const preferredThemes = PERSONA_THEME_MAP[personaType] || PERSONA_THEME_MAP["default"];

  console.log(`[linkedin-post-generator] Persona type: ${personaType}`);
  console.log(`[linkedin-post-generator] Selection strategy: ${themedCount} themed + ${randomCount} random = ${count} total`);

  // Score chats by theme overlap
  const scored = chatsWithThemes.map(cwt => {
    let score = 0;
    for (const theme of preferredThemes) {
      if (cwt.themes.includes(theme)) {
        score += 2;
      }
    }
    if (cwt.themes.includes("brutal-honesty")) {
      score += 1;
    }
    // Add random jitter to break ties and add variety
    score += Math.random() * 0.5;
    return { ...cwt, score };
  });

  // PART 1: Get themed chats (top scorers, shuffled)
  const sortedByScore = [...scored].sort((a, b) => b.score - a.score);
  const topThemed = sortedByScore.slice(0, Math.min(themedCount * 3, sortedByScore.length));

  // Shuffle themed pool
  for (let i = topThemed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topThemed[i], topThemed[j]] = [topThemed[j], topThemed[i]];
  }
  const selectedThemed = topThemed.slice(0, themedCount);
  const themedIndices = new Set(selectedThemed.map(s => s.originalIndex));

  // PART 2: Get random chats (from remaining pool, fully random)
  const remainingChats = scored.filter(s => !themedIndices.has(s.originalIndex));

  // True random shuffle of all remaining chats
  for (let i = remainingChats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remainingChats[i], remainingChats[j]] = [remainingChats[j], remainingChats[i]];
  }
  const selectedRandom = remainingChats.slice(0, randomCount);

  // Combine and shuffle final selection
  const combined = [...selectedThemed, ...selectedRandom];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  const selected = combined.map(s => s.chat);

  console.log(`[linkedin-post-generator] Selected ${selected.length} chats for ${personality.username} (${themedCount} themed, ${selectedRandom.length} random)`);

  return selected;
}

// ============================================
// POWER POOLS FOR ROTATION
// ============================================

// Individual powers - will be randomly sampled (not grouped)
const ALL_POWERS = [
  // Job Search
  'Finds one specific job match instead of dumping 100 irrelevant listings',
  'Gives honest salary reality checks based on actual market data',
  'Reviews resumes with brutal honesty - no sugar coating',
  'Tells you if a role is actually worth your time',
  'Filters out jobs that are lateral moves dressed as promotions',

  // Work & Daily
  'Sets reminders and actually follows up on them',
  'Helps draft difficult work conversations',
  'Crafts leave requests that work',
  'Helps with awkward workplace messages',

  // Fun & Playful
  'Roasts your career choices (surprisingly accurate)',
  'Predicts career trajectories based on patterns',
  'Gives unsolicited but useful career advice',
  'Generates roast cards based on company/role',

  // Intel & Research
  'Decodes corporate job post jargon',
  'Spots red flags in job descriptions',
  'Researches company culture from multiple sources',
  'Gives real salary numbers instead of "competitive"',
  'Exposes inflated job titles',

  // Honesty
  'Calls out when a role is overhyped',
  'Points out if you are being underpaid',
  'Tells you when a move is actually lateral',
  'Cuts through recruiter speak',
  'Gives the uncomfortable truths about your market value',

  // Action
  'Encourages applying even when you feel underqualified',
  'Reframes your experience in useful ways',
  'Pushes you to negotiate instead of accepting first offers',
  'Reminds you that rejection is just information'
];

const OPENER_VARIANTS = [
  "a friend showed me this",
  "a friend built this",
  "a friend at Grapevine sent this over",
  "the team at Grapevine has been building something",
  "tried this for a few minutes",
  "used this for a bit",
  "saw this recently",
  "got shown this by a friend",
  "a friend working on this sent it over",
  "shoutout to the team building this",
  "came across an AI career agent",
  "saw a new tool called Tal"
];

// ============================================
// VARIATION POOLS - Force different outputs
// ============================================

// Different emotional tones for the post
const POST_MOODS = [
  {
    name: "Curious Observer",
    instruction: "Write as someone who found something interesting and is sharing an observation. Tone: curious, slightly detached, analytical. NOT impressed, just... noticing something.",
    hookStyle: "Start with an observation or a question that arose from the experience."
  },
  {
    name: "Reluctant Skeptic",
    instruction: "Write as someone who was skeptical but had their skepticism addressed. Tone: measured, honest, slightly surprised. The surprise should be understated, not dramatic.",
    hookStyle: "Start with your initial skepticism or low expectations."
  },
  {
    name: "Pragmatic Professional",
    instruction: "Write as someone focused purely on utility. Tone: practical, no-nonsense, efficiency-focused. Zero emotional language. Just: this does X, which is useful.",
    hookStyle: "Start with a problem or friction point in your work life."
  },
  {
    name: "Insider Sharing",
    instruction: "Write as someone sharing something from their professional circle. Tone: casual, peer-to-peer, like you're telling a colleague about something you saw.",
    hookStyle: "Start by mentioning the source (friend, colleague, someone in the space)."
  },
  {
    name: "Thoughtful Contrarian",
    instruction: "Write as someone who notices what's different about this compared to the norm. Tone: reflective, slightly contrarian, noticing a pattern break.",
    hookStyle: "Start by noting what's typically broken or annoying about similar tools."
  },
  {
    name: "Minimalist Sharer",
    instruction: "Write the shortest possible version. Tone: extremely concise, almost curt. Get to the point immediately. No preamble, no buildup.",
    hookStyle: "Start directly with the key insight or observation. No setup."
  }
];

// Different structural templates
const STRUCTURE_TEMPLATES = [
  {
    name: "Observation → Detail → Implication",
    structure: "1. State what you noticed (1 sentence). 2. Give one specific detail (1-2 sentences). 3. What it means or why it matters (1 sentence)."
  },
  {
    name: "Context → Discovery → Reflection",
    structure: "1. Brief context of how you encountered it (1 sentence). 2. What you discovered (1-2 sentences). 3. A brief reflection or thought (1 sentence)."
  },
  {
    name: "Problem → Experience → Outcome",
    structure: "1. A problem or friction you face (1 sentence). 2. How this addressed it (1-2 sentences). 3. The result or your takeaway (1 sentence)."
  },
  {
    name: "Question → Answer → Insight",
    structure: "1. Open with a question (rhetorical or genuine). 2. Answer it with what you found (1-2 sentences). 3. A broader insight (1 sentence)."
  },
  {
    name: "Contrast → Specific → Conclusion",
    structure: "1. Contrast with what's typical (1 sentence). 2. One specific thing that was different (1-2 sentences). 3. Brief conclusion (1 sentence)."
  },
  {
    name: "Direct Statement → Evidence → Close",
    structure: "1. Make a direct statement/claim (1 sentence). 2. Support it with one specific example (1-2 sentences). 3. Simple close (1 sentence)."
  }
];

// Different focus areas - what aspect of the experience to highlight
const FOCUS_AREAS = [
  {
    name: "The Conversation Quality",
    instruction: "Focus on HOW it felt to interact - the conversational quality, the tone, the back-and-forth. Not features, but the experience of talking to it."
  },
  {
    name: "The Honesty Factor",
    instruction: "Focus specifically on the directness/honesty of the feedback. Highlight a moment where it said something others wouldn't."
  },
  {
    name: "The Specificity",
    instruction: "Focus on how specific and tailored the response was. Not generic advice, but something that felt like it understood YOUR situation."
  },
  {
    name: "The Time Saved",
    instruction: "Focus on efficiency - how it cut through noise, saved time, got to the point faster than alternatives."
  },
  {
    name: "The Unexpected Insight",
    instruction: "Focus on something surprising it revealed - an insight you hadn't considered, a reframe you needed."
  },
  {
    name: "The Human Feel",
    instruction: "Focus on how it felt less robotic, more like talking to a knowledgeable person. Contrast with typical AI interactions."
  }
];

interface VariationSeed {
  mood: typeof POST_MOODS[0];
  structure: typeof STRUCTURE_TEMPLATES[0];
  focus: typeof FOCUS_AREAS[0];
  selectedPowers: string[];
  openerHint: string;
}

function getVariationSeed(username: string): VariationSeed {
  // Shuffle and pick one from each pool
  const mood = POST_MOODS[Math.floor(Math.random() * POST_MOODS.length)];
  const structure = STRUCTURE_TEMPLATES[Math.floor(Math.random() * STRUCTURE_TEMPLATES.length)];
  const focus = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)];

  // Shuffle all powers and pick 4-6 random ones
  const shuffled = [...ALL_POWERS].sort(() => Math.random() - 0.5);
  const count = 4 + Math.floor(Math.random() * 3); // 4-6 powers
  const selectedPowers = shuffled.slice(0, count);

  // Random opener each time
  const openerIndex = Math.floor(Math.random() * OPENER_VARIANTS.length);
  const openerHint = OPENER_VARIANTS[openerIndex];

  console.log(`[linkedin-post-generator] Variation for ${username}:`);
  console.log(`  Mood: ${mood.name}`);
  console.log(`  Structure: ${structure.name}`);
  console.log(`  Focus: ${focus.name}`);
  console.log(`  Powers: ${count} selected`);
  console.log(`  Opener: "${openerHint}"`);

  return { mood, structure, focus, selectedPowers, openerHint };
}

// ============================================
// HELPER: BUILD USER PROMPT
// ============================================

function buildUserPrompt(
  personality: LinkedInPostGeneratorInput["personality"],
  tal: LinkedInPostGeneratorInput["tal"],
  targetWordCount: number,
  options?: LinkedInPostGeneratorInput["options"]
): string {
  const sections: string[] = [];

  // ---- SECTION 1: PERSONALITY ----
  sections.push(`# PERSON'S PERSONALITY & WRITING STYLE`);

  if (personality.profileSnapshot) {
    const ps = personality.profileSnapshot;
    sections.push(`## Profile
- Name/Username: ${personality.username}
- Role: ${ps.currentRole || "Unknown"}
- Company: ${ps.currentCompany || "Unknown"}
- Seniority: ${ps.seniority || "Unknown"}
- Domain: ${ps.domain || "Unknown"}
- Summary: ${ps.summary || ""}`);
  }

  if (personality.personalityGraph) {
    const pg = personality.personalityGraph;
    sections.push(`## Personality
${pg.dominantPersonalitySummary || ""}

- Core Identity: ${pg.coreIdentity?.inference || "Unknown"}
- Communication Style: ${pg.communicationStyle?.inference || "Unknown"}
- Public Brand Intent: ${pg.publicBrandIntent?.inference || "Unknown"}`);
  }

  if (personality.autoWritingGraph) {
    const awg = personality.autoWritingGraph;
    const wc = awg.writingCharacteristics || {};
    const habits = awg.lexicalFormattingHabits || {};

    sections.push(`## Writing Style (CRITICAL - MATCH EXACTLY)

TONE: ${(awg.toneProfile || []).join(", ")}

CHARACTERISTICS:
- Sentence Length: ${wc.sentenceLength || "Unknown"}
- Directness: ${wc.directness || "Unknown"}
- Hook Style: ${wc.hookStyle || "Unknown"}
- CTA Behavior: ${wc.ctaBehavior || "Unknown"}

RHETORICAL DEVICES: ${(awg.rhetoricalDevices || []).join(", ")}

SIGNATURE MOVES: ${(awg.signatureWritingMoves || []).join("; ")}

FORMATTING:
- Short Lines: ${habits.shortLines ? "Yes" : "No"}
- Spaced Paragraphs: ${habits.spacedParagraphs ? "Yes" : "No"}
- Emoji Usage: ${habits.emojiUsage || "none"} (IF "sparse" or "none", DO NOT USE EMOJIS)

IMITATION GUIDANCE: ${awg.writingImitationGuidance || "Match their natural voice"}

ANTI-PATTERNS (NEVER DO): ${(awg.antiPatterns || []).join("; ")}`);
  }

  if (personality.personaPrompt) {
    sections.push(`## Persona Prompt
${personality.personaPrompt}`);
  }

  if (personality.talCompatibilityLayer) {
    const tcl = personality.talCompatibilityLayer;
    sections.push(`## How This Person Would React to Tal
- Perception: ${tcl.howTheyWouldPerceiveTal || "Unknown"}
- Messaging that resonates: ${tcl.messagingStyleThatResonates || "Unknown"}
- Messaging that repels: ${tcl.messagingStyleThatRepels || "Unknown"}
- Preferred tone: ${tcl.preferredTone || "Unknown"}`);
  }

  // ---- SECTION 2: VARIATION SEED (forces different outputs) ----
  const variationSeed = getVariationSeed(personality.username);
  const { mood, structure, focus, selectedPowers, openerHint } = variationSeed;

  sections.push(`# 🎲 VARIATION INSTRUCTIONS (MANDATORY)

You MUST follow these randomly-selected variation parameters to ensure this post is unique:

## POST MOOD: ${mood.name}
${mood.instruction}
Hook Style: ${mood.hookStyle}

## STRUCTURE TEMPLATE: ${structure.name}
${structure.structure}

## FOCUS AREA: ${focus.name}
${focus.instruction}

These are NOT suggestions. You MUST follow the mood, structure, and focus area above.
The goal is to ensure every generated post feels meaningfully different.`);

  // ---- SECTION 3: TAL CONTEXT (with random power rotation) ----

  sections.push(`\n# TAL - WHAT THIS PERSON EXPLORED`);

  if (tal.systemPrompt) {
    // Truncate if too long
    const truncated =
      tal.systemPrompt.length > 8000
        ? tal.systemPrompt.slice(0, 8000) + "\n... [truncated]"
        : tal.systemPrompt;
    sections.push(`## Tal's System Prompt (How Tal Actually Works)
${truncated}`);
  }

  if (tal.lore) {
    sections.push(`## Tal's Backstory
${tal.lore}`);
  }

  // Build powers section with randomly selected individual powers
  const powersSection = selectedPowers.map(p => `- ${p}`).join('\n');

  sections.push(`## TAL POWERS FOR THIS POST (USE ONLY THESE)

These are the specific capabilities this person might have noticed:

${powersSection}

IMPORTANT:
- Pick ONE capability from this list to highlight
- Describe what it DOES for the person, not what it IS
- Do NOT copy these descriptions verbatim - rephrase naturally
- Do NOT invent capabilities not listed here

## OPENER SUGGESTION
Consider starting with or weaving in: "${openerHint}"

Other strong openers (pick ONE, do NOT start with "someone"):
- "a friend built this"
- "a friend at Grapevine showed me this"
- "tried this for a few minutes"
- "the team at Grapevine has been building something"
- "shoutout to the team behind this"
- "came across an AI career agent"
- "saw a new tool called Tal"

Do NOT start with:
- "someone showed me..."
- "most career tools..."
- "the problem with..."
- Any generic category critique

BANNED UNNATURAL PHRASES (NEVER use any variation of these):
- "poked around" / "poked around with"
- "played around" / "playing around" / "play around"
- "stumbled upon" / "stumbled across"
- "gave it a spin" / "giving it a spin"
- "took it for a test drive"
- "dove into" / "diving into"
- "had a chance to explore"
- "been exploring"
- "spent time with" / "spent some time with"
- "checked out"

Use natural phrases instead: "tried", "used", "saw", "came across"`);

  // Add PERSONALITY-MATCHED sample chats (uses all chats, selects based on persona)
  // When regenerating, force completely random chat selection for variety
  const isRegeneration = options?.regenerate || false;
  if (tal.sampleChats && tal.sampleChats.length > 0) {
    const matchedChats = selectChatsForPersonality(tal.sampleChats, personality, 50, isRegeneration);

    sections.push(`\n## TAL CONVERSATIONS (matched to this person's likely interests)`);

    for (const chat of matchedChats) {
      const messages = chat.messages || chat.data?.messages || [];
      const preview = messages
        .slice(0, 12)
        .map((m: any) => `${m.role}: ${(m.content || "").slice(0, 400)}`)
        .join("\n");
      sections.push(`### Chat Example
${preview}
...`);
    }

    sections.push(`\nThese chats were selected because they align with this person's professional context.
Use specific moments, quotes, or observations from these chats to make the post feel grounded and real.
Do NOT summarize all chats - pick ONE or TWO moments that would resonate with this person.`);
  }

  // ---- SECTION 3: WORD COUNT & OPTIONS ----
  sections.push(`\n# WORD COUNT LIMIT (STRICT - BASED ON USER'S POSTING HISTORY)
🚨 HARD LIMIT: ${targetWordCount} words maximum.
This is their typical LinkedIn post length. Do NOT exceed this.
Count your words before finalizing. If over ${targetWordCount}, cut it down.`);

  if (options?.customContext) {
    sections.push(`\n# ADDITIONAL CONTEXT
${options.customContext}`);
  }

  // ---- SECTION 4: CORE MESSAGE ----
  sections.push(`\n# CORE MESSAGE TO CONVEY
The post should softly communicate that Tal is interesting, thoughtfully built, and worth attention.
Tal is a career agent that helps Indian professionals find better work through conversational interaction.
The post should reflect what someone with this personality profile would authentically notice and appreciate about Tal.`);

  // ---- REGENERATION INSTRUCTION (if applicable) ----
  if (isRegeneration) {
    sections.push(`\n# ⚡ REGENERATION MODE ⚡
This is a REGENERATION request. The user has already seen a previous version.
You MUST:
1. Use a COMPLETELY DIFFERENT discovery narrative/angle than typical
2. Focus on a DIFFERENT TAL capability from the chats provided
3. Use a DIFFERENT hook structure and opening line
4. The post should feel fresh and distinct, not a variation of a template

Be creative. Surprise the user with a new perspective.`);
  }

  // ---- FINAL INSTRUCTION ----
  sections.push(`\n# TASK
Generate a LinkedIn post that feels naturally compatible with ${personality.username}'s inferred professional taste, tone, and worldview.

This is NOT impersonation. This is style-aligned original content.

Return plain text in this exact format:
POST:
[the post]

ALT VERSION:
[alternate version]

Do NOT return JSON.`);

  return sections.join("\n\n");
}

// ============================================
// TOOL DEFINITION
// ============================================

export const linkedInPostGeneratorTool = {
  id: "linkedin-post-generator",
  name: "LinkedIn Post Generator",
  description:
    "Generate a LinkedIn post about Tal in a person's authentic voice. Requires personality data and Tal context as input.",
  inputSchema: LinkedInPostGeneratorInputSchema,
  outputSchema: LinkedInPostGeneratorOutputSchema,
  execute: generateLinkedInPost,
};

export default linkedInPostGeneratorTool;
