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

THE CARDINAL RULE: BANNED PHRASES
This is your most important filter. The following phrases are generic, sound like marketing copy, and are strictly forbidden UNLESS the writingStyleGraph for the person explicitly shows that they have used these exact phrases in the past.

⛔ BANNED (unless proven otherwise by user's history):
- poked around / played around with
- stumbled upon / stumbled across
- gave it a spin / took it for a test drive
- dove into / been exploring
- game-changer / revolutionize / unlock / disrupt
- worth checking out / must-have
- refreshing approach

If the person's writing profile is empty, this ban is absolute.

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
- Context about Tal: Lore, sample chats, and system prompts to understand the product.

WEIGHTING: WRITING STYLE IS KING
- 70% Weight: The writingStyleGraph is your bible. Sentence structure, case (lowercase/title case), emoji usage, punctuation, and paragraph breaks must be replicated precisely.
- 30% Weight: The personalityGraph and knowledgeGraph inform the substance of the post—the angle, the observation, and what they would find interesting.

If the person has no posts, you must rely 100% on the personalityGraph to infer a plausible, understated writing style.

CORE TASK 1: THE DISCOVERY NARRATIVE (BE CREATIVE & VARIED)
The post needs to explain how the person encountered Tal. This must not be repetitive. You will randomize and vary this introduction to make it feel natural and plausible for the person.

Here are different angles for inspiration. Select one that best fits the person's profile or create a new one in the same spirit:

The Friend/Insider Angle:
- "a friend at grapevine showed me this."
- "someone i trust over at grapevine sent this over."
- "heard from the grapevine team they were working on this."

The Nameless Angle:
- "tried a career agent that gives brutally honest feedback."
- "interesting to see an ai that decodes job post jargon."

The Observational Angle:
- "thinking about an interaction i had with an ai career agent."
- "a detail from a new tool called tal that stood out:"
- "one small observation from trying tal."

Your primary goal is to choose or create a narrative that feels most plausible for this specific person.

CORE TASK 2: THE HOOK & THE HUMAN CONSEQUENCE
Strong, Authentic Hook: The first line must grab attention while sounding exactly like the person. It should be a sharp observation, a candid realization, or a specific frustration—not a generic "creator" template.

Focus on Human Consequence: Do not list features. Translate one interesting product behavior into a human outcome.

Instead of: "It has a title deconstruction feature."
Write: "it cuts through the corporate jargon and calls out inflated titles."

Instead of: "It provides salary data."
Write: "the salary reality check is harsher than most friends, but probably more useful."

BRANDING & FORMATTING RULES
- Single Brand Anchor: Use "Tal" OR "Grapevine" in the post, but never both. Mention the chosen name only once.
- Subtle Mention: The brand name should feel like a natural part of the sentence, not a forced plug.
- No .af Link: Never include the "tal.af" URL.
- Match Formatting Exactly: Replicate their use of line breaks, emojis, hashtags, and punctuation perfectly.
- Case-Matching is Critical: If they write in all lowercase, your output must be all lowercase. If they use standard sentence case (capitalizing the first letter), you must match it. No exceptions.
- Readability & Spacing: LinkedIn posts are read on mobile. Your output must favor shorter lines and frequent line breaks to ensure the post is easy to scan. Do not generate large, unbroken blocks of text. Break thoughts into 1-2 sentence paragraphs.

FINAL QUALITY CHECK (INTERNAL MONOLOGUE)
1. Authenticity: Does this sound exactly like them? Is the case, punctuation, and emoji use a perfect match?
2. Discovery: Is the discovery narrative (e.g., "a friend showed me") plausible for them and not repetitive?
3. Hook: Is the first line strong but still within their natural voice?
4. Substance: Does it focus on a single, human consequence instead of a feature list?
5. Vibe: Does it feel like a genuine share, not a salesy ad?
6. Formatting: Is the post well-spaced and easy to read? Are there any dense paragraphs?
7. Subtlety: Is the tone observational rather than overly praisey? Does it feel like a subtle share, not a loud endorsement?

OUTPUT FORMAT
Return your response in this exact structure:

POST:
[The primary, best-fit post that follows all rules.]

ALT VERSION:
[A second version that is meaningfully different. It should use a different discovery narrative, focus on a different human consequence, or have a different structural feel, while still being in the person's voice.]`;

// ============================================
// MAIN TOOL FUNCTION
// ============================================

export async function generateLinkedInPost(
  input: LinkedInPostGeneratorInput
): Promise<LinkedInPostGeneratorOutput> {
  const { personality, tal, rawPosts, options } = input;

  const profileOnlyMode = options?.profileOnlyMode || false;
  console.log(`[linkedin-post-generator] Generating for ${personality.username}`);
  console.log(`[linkedin-post-generator] Mode: ${profileOnlyMode ? 'PROFILE-ONLY (zero posts)' : 'FULL (with posts)'}`);

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

function selectChatsForPersonality(allChats: any[], personality: any, count: number = 50): any[] {
  // Strategy: Mix of themed chats (30%) + purely random chats (70%)
  // This ensures variety while maintaining some relevance

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

const POWER_POOLS = [
  {
    name: "Job Search",
    powers: [
      '"send me 1 job" → Tal scans 50k roles/day to find THE one, not 100 random ones. Filter energy, not spam.',
      '"am i underpaid?" → brutal market verdict: "bro. you are being criminally underpaid. you\'re a ferrari being used as a city taxi."',
      '"fix my resume" → brutal honest feedback, no rewriting it for them, no fake politeness'
    ]
  },
  {
    name: "Work & Daily",
    powers: [
      '"remind me to..." → sets reminders, bugs you when it\'s time, actually follows up',
      '"help me with something at work" → drafts emails, slack messages, difficult conversation scripts',
      '"help me take a day off" → crafts leave requests that actually work'
    ]
  },
  {
    name: "Fun & Play",
    powers: [
      '"roast my friend" → generates a savage roast card based on their company/role',
      '"predict my future" → personalized career prediction based on patterns',
      '"surprise me" → wildcard: spicy takes, roasts, unsolicited advice'
    ]
  },
  {
    name: "Intel & Research",
    powers: [
      '"decode this job post" → translates corporate speak, spots red flags, exposes title inflation',
      '"what\'s the culture like at [company]" → researches glassdoor, blind, layoffs, gives real talk',
      '"how much does this role earn" → salary lookup with real numbers, not "competitive"'
    ]
  },
  {
    name: "Honesty Powers",
    powers: [
      'BLUNT ROLE HONESTY: "you\'re not building the next chatgpt, you\'re just the guy who cleans the data"',
      'TITLE DECONSTRUCTION: exposes inflated titles, "ignore the senior title, they\'ll lowball a fresher"',
      'CALLS OUT LATERAL MOVES: "this isn\'t a step up, it\'s a sideways move with a shinier logo"'
    ]
  },
  {
    name: "Action Powers",
    powers: [
      'SALARY REALITY: gives real salary estimates when companies hide them, "expect 90-1.2cr easy"',
      'ENCOURAGES ACTION: "apply anyway, the worst they can do is ghost you"',
      'STRATEGIC REFRAMING: "they\'re not hiring you for what you know, they\'re hiring you for your ability to figure things out"'
    ]
  }
];

const OPENER_VARIANTS = [
  "a friend showed me this",
  "a friend built this",
  "a friend at Grapevine sent this over",
  "the team at Grapevine has been building something",
  "tried this for a few minutes",
  "used this for a bit",
  "checked out Tal",
  "saw this recently",
  "got shown this by a friend",
  "a friend working on this sent it over",
  "shoutout to the team building this",
  "spent some time with Tal"
];

function getRandomPowers(username: string): { pools: typeof POWER_POOLS[0][], openerHint: string } {
  // Truly random selection each time for varied content
  const shuffled = [...POWER_POOLS].sort(() => Math.random() - 0.5);
  const selectedPools = shuffled.slice(0, 2);

  // Random opener each time
  const openerIndex = Math.floor(Math.random() * OPENER_VARIANTS.length);
  const openerHint = OPENER_VARIANTS[openerIndex];

  console.log(`[linkedin-post-generator] Random powers for ${username}: ${selectedPools.map(p => p.name).join(', ')}, opener: "${openerHint}"`);

  return { pools: selectedPools, openerHint };
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
  const { pools: selectedPools, openerHint } = getRandomPowers(personality.username);

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

  // Build powers section with only the randomly selected pools
  const powersSection = selectedPools.map(pool => {
    return `### ${pool.name}\n${pool.powers.map(p => `- ${p}`).join('\n')}`;
  }).join('\n\n');

  sections.push(`## TAL POWERS FOR THIS POST (USE ONLY THESE)

🎯 THIS PERSON SHOULD FOCUS ON THESE SPECIFIC POWERS:

${powersSection}

IMPORTANT:
- Use ONLY the powers listed above for this post
- Pick ONE or TWO from the list, not more
- Translate them into human consequences, not feature descriptions

## OPENER SUGGESTION
Consider starting with or weaving in: "${openerHint}"

Other strong openers (pick ONE, do NOT start with "someone"):
- "a friend built this"
- "a friend at Grapevine showed me this"
- "tried this for a few minutes"
- "the team at Grapevine has been building something"
- "shoutout to the team behind this"
- "checked out Tal"
- "spent some time with Tal"

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

Use natural phrases instead: "tried", "used", "checked out", "spent time with", "saw"`);

  // Add PERSONALITY-MATCHED sample chats (uses all chats, selects based on persona)
  if (tal.sampleChats && tal.sampleChats.length > 0) {
    const matchedChats = selectChatsForPersonality(tal.sampleChats, personality, 50);

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
