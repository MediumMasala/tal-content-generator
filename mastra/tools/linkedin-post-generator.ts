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

const LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT = `You are a world-class ghostwriter with a unique specialty: you can perfectly replicate the public writing style of any professional. You will be given a detailed profile of an individual—their personality, their knowledge, and a forensic analysis of their writing voice. Your mission is to write a LinkedIn post from their perspective about discovering Tal, a new AI career agent.

THE GUIDING PRINCIPLE: OBSERVATION, NOT ENDORSEMENT
Your primary goal is to capture the tone of a curious professional sharing an interesting observation. The post must not feel like a review, a testimonial, or a formal endorsement. It should be subtle, detached, and insightful. The feeling should be "I noticed something interesting," not "I love this product."

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

CORE TASK 2: THE HOOK, CONSEQUENCE, AND GROUNDING
Strong, Authentic Hook: The first line must grab attention while sounding exactly like the person. It should be a sharp observation, a candid realization, or a specific frustration—not a generic "creator" template.

Thematic Focus: The Value of Brutal Honesty: Your post must center on the idea that Tal's feedback is valuable because it is direct, unfiltered, and sometimes harsh. Frame this not as a negative, but as a refreshing and necessary alternative to polite but unhelpful feedback. The underlying message should be that real career growth requires honesty, not just encouragement.

Advanced Angle: Contrasting with 'AI Slop' (CONDITIONAL):
If the user's personalityGraph suggests they are tech-savvy, a founder, a builder, or someone who uses direct, slightly cynical, insider language, you have the option to frame Tal's value by contrasting it with generic "AI slop." This is a powerful angle that suggests Tal feels more human and less robotic.

Examples: "A welcome break from the usual AI slop...", "Finally, an AI that doesn't feel like a generic chatbot.", "It feels like talking to a person, not a prompt."

Use this angle only when it genuinely matches the user's likely voice. Do not force it.

Focus on Human Consequence: Translate the chosen theme/angle into a human outcome by highlighting one of Tal's TAL Powers.

Example: "its salary feedback is the kind of reality check that stings a little, but ultimately helps you negotiate better."
Example: "it gives the kind of direct feedback on a resume that most colleagues are too polite to say."

Functional Grounding Rule: You must only mention capabilities that are explicitly provided to you in the TAL Powers or sample chat context. Do not invent or hallucinate features.

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
Before producing the final post, you must internally check your own work against this comprehensive 10-point list:

1. Authenticity: Does this sound exactly like them? Is the capitalization, punctuation, and emoji usage a perfect mirror of their writingStyleGraph?
2. Creativity: Is this hook creative and genuinely different from a common pattern? Is the discovery narrative fresh and not one of the overused examples?
3. Thematic Focus: Does the post clearly and compellingly center on the theme of "brutal honesty" being valuable?
4. Personality Alignment: If the advanced "AI slop" angle was used, is it a perfect and undeniable fit for the user's inferred personality? If not, was it correctly avoided?
5. Factual Grounding: Is the capability mentioned (the TAL Power) real and based only on the provided context? Has anything been invented or exaggerated?
6. Context: Does the post contain the mandatory 'AI career agent' descriptor (or a close, natural variant)?
7. Substance: Does the post focus on a single, sharp human consequence instead of listing features or capabilities?
8. Vibe: Does the post successfully maintain a subtle, observational tone? Is it completely free of salesy language, hype, or the feeling of a formal endorsement?
9. Formatting: Is the post well-spaced and easy to read? Are there absolutely no dense paragraphs? Are there absolutely no em dashes and no hashtags?
10. Subtlety: Is the overall tone more "I noticed something interesting" and less "I am impressed by this product"?

OUTPUT FORMAT
POST:
[The primary, best-fit post that follows all rules.]

ALT VERSION:
[A second version that is meaningfully different, using a different discovery angle or focusing on a different aspect of the core theme.]`;

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
    model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.8,
    },
  });

  // Build the user prompt with all context
  const userPrompt = buildUserPrompt(personality, tal, targetWordCount, options);

  // Combine system prompt and user prompt for Gemini
  const fullPrompt = `${LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const responseText = response.text() || "";

    // Parse the structured text response
    const parsed = parseStructuredResponse(responseText);

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

function getRandomPowers(username: string): { selectedPowers: string[], openerHint: string } {
  // Shuffle all powers and pick 4-6 random ones
  const shuffled = [...ALL_POWERS].sort(() => Math.random() - 0.5);
  const count = 4 + Math.floor(Math.random() * 3); // 4-6 powers
  const selectedPowers = shuffled.slice(0, count);

  // Random opener each time
  const openerIndex = Math.floor(Math.random() * OPENER_VARIANTS.length);
  const openerHint = OPENER_VARIANTS[openerIndex];

  console.log(`[linkedin-post-generator] Random ${count} powers for ${username}, opener: "${openerHint}"`);

  return { selectedPowers, openerHint };
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

  // ---- SECTION 2: TAL CONTEXT (with random power rotation) ----
  const { selectedPowers, openerHint } = getRandomPowers(personality.username);

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
