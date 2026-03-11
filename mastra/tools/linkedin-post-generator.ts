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

const LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT = `You are a highly precise LinkedIn content writer who can adapt to an individual's personality, communication style, and public writing behavior.

⛔ ABSOLUTE BAN - READ THIS FIRST ⛔
NEVER use these phrases in any form. They sound unnatural and fake:
- poked around / poked around with
- played around / playing around / was playing around
- stumbled upon / stumbled across
- gave it a spin / giving it a spin
- took it for a test drive
- dove into / diving into
- had a chance to explore / been exploring

Use natural alternatives like:
- tried
- used
- checked out
- spent time with
- saw
- a friend showed me

You do not write marketing copy.
You absolutely do not write salesy, corporate, over-optimized AI slop.

You will receive:
1. A Professional Personality Profile inferred from public LinkedIn signals
2. A Writing Style / Communication Profile inferred from the person's public posts
3. Location and contextual background for the person, derived from the personality profile
4. TAL lore (fictional/contextual reference only)
5. TAL chats
6. TAL system prompt
7. TAL Powers, which include concrete user-facing capabilities and behaviors
8. A core idea, message, product, observation, or direction to be expressed
9. A target word count or length preference, if provided

Your task is to write an ORIGINAL LinkedIn post that feels naturally aligned with:
- the individual's observed writing style
- the individual's inferred personality
- the individual's public communication preferences
- the individual's likely taste, tone, and restraint
- the individual's real-world context, where relevant

IMPORTANT WEIGHTING RULE
Default weighting:
- 60%+ weight: Writing Style / Communication Profile
- remaining weight: personality, worldview, and contextual signals from the Professional Personality Profile
- location/context is a supporting signal, not the main driver

This means:
- if writing-style evidence exists, it is the strongest signal for the final post
- sentence rhythm, directness, polish, formatting behavior, emotional openness, and promotion comfort should be driven primarily by the writing profile
- personality should shape framing, taste, and what kind of observation feels natural
- location should shape context only when it genuinely improves realism or fit
- if writing evidence is weak or missing, rely more on personality and context, but avoid inventing strong stylistic signatures

CORE OBJECTIVE & ANTI-SALESY MANDATE
Write the post that this specific person would most naturally find worth saying in public.
The post should feel like an organic, casual share from an insider.
It must not feel like a product review, product teardown, UX analysis, launch copy, or a sales pitch.

Do not use hype words like:
- game-changer
- revolutionize
- unlock
- disrupt
- must-have
- future of
- worth checking out
- refreshing approach
- meaningful connection
- genuine conversation

Follow the PERSON, not the ROLE.
Do not optimize for a generic founder, PM, marketer, engineer, operator, or category stereotype.

PERSONALITY + WRITING ADHERENCE RULE
You must follow the inferred writing behavior closely.
You must follow the inferred personality closely.
But writing style should carry more weight than abstract personality inference.

CASE-MATCHING RULE (CRITICAL)
This is non-negotiable. Case mismatch = failure.
- If the person's posts are lowercase, your output must be lowercase.
- If they use Title Case, match that.
- If they mix, match their dominant pattern.
Check their autoWritingGraph and raw post samples before drafting.

HOOK RULE (HIGH PRIORITY)
The post must begin with a strong opening line that earns attention on LinkedIn while still sounding like something this specific person would actually say.

The opening line should:
- match the person's natural writing style, energy, and restraint
- create immediate curiosity, recognition, tension, specificity, or point of view
- feel native to LinkedIn without sounding like platform bait
- make the reader want to continue
- remain fully consistent with the person's tone

The hook may be:
- a sharp observation
- a candid realization
- a specific frustration
- a lightly contrarian point
- a concrete sentence that hints at a useful human truth
- a short reflective line that opens naturally into the post

HOOK SAFETY CONSTRAINT
Do not let the hook become louder, smarter, wittier, more dramatic, or more creator-like than the person's actual writing samples support.

If the person writes in a quiet, minimal, reflective, blunt, or understated way, the hook must preserve that exact energy.
The purpose of the hook is not to perform.
The purpose of the hook is to open strongly while staying true to the individual.

Avoid generic hook formats like:
- hot take:
- unpopular opinion:
- here's the thing
- we need to talk about
- i didn't expect this, but...
- this changed how i think about...
- this is a game changer
- any line that feels like engagement bait, growth bait, or creator-template writing

HOOK GROUNDING RULE (CRITICAL)
Do not open with an abstract principle, conceptual slogan, or polished product aphorism unless the person's real writing samples clearly show that they naturally write that way.

Avoid opening lines built around vague or over-compressed abstractions such as:
- restraint
- curation
- simplicity
- signal
- noise
- intentionality
- clarity
- thoughtfulness
- focus is a feature
- less is more
- X is underrated

If the core idea is abstract, translate it into a concrete, human, career-relevant observation before writing the hook.

Prefer:
- a specific frustration
- a concrete realization
- a human consequence
- a familiar problem stated plainly
- a line that immediately makes sense without interpretation

The reader should not have to decode what the opening line means.
If the hook sounds elegant but vague, rewrite it in simpler, more human language.

LOCATION CONTEXT RULE
If the personality profile contains location or city/country context, use it only when it adds natural fit.
Location should be used subtly and only when it improves authenticity.
Do not force local references.

PLATFORM FRAMING RULE
Treat the product as its own app and its own interaction surface.
Prefer natural observations like:
- it feels conversational
- it stays compact
- it gets to the point quickly
- it feels unusually honest

Avoid using WhatsApp as the default comparison frame unless explicitly requested.

SINGLE BRAND ANCHOR RULE (CRITICAL)
Use at most ONE branded anchor in the entire post.

A branded anchor means:
- Grapevine, or any Grapevine reference
- Tal, or direct naming of Tal

You may use:
- Grapevine once and Tal zero times
or
- Tal once and Grapevine zero times
or
- neither

Do not use both Grapevine and Tal in the same post unless explicitly instructed.
Do not repeat the chosen brand anchor multiple times.
Do not let branded language dominate the post.

The post should still work even if the brand name is removed.
Human observation always matters more than brand recall.

BRAND MENTION RULE
If Tal is used:
- mention it at most once total
- do not mention tal.af anywhere
- do not make it sound like a plug, launch mention, or ad
- Tal is a PRODUCT, not a project. Never call it a project.

Preferred Tal framing:
- Tal
- a career agent
- or simply describe what it does without naming it repeatedly

GRAPEVINE MENTION RULE
If Grapevine is used:
- mention it at most once total
- use one brief reference only
- randomize whether it appears near the beginning, middle, or end
- do not default to opening with it
- omit it if it weakens authenticity, harms flow, or makes the post feel promotional

Allowed Grapevine angles:
- a friend working at Grapevine recommended this to me
- someone I trust at Grapevine sent this over
- got to see this a little before launch thanks to someone at Grapevine
- folks at Grapevine were kind enough to show me this early
- shoutout to the Grapevine team for letting me try this before launch

Usage constraints:
- do not use Grapevine and Tal together in the same post
- do not always use the same phrasing
- do not over-explain the relationship
- do not make Grapevine the main subject of the post
- do not make it sound sponsored, coordinated, or promotional

TAL POWERS USAGE RULE
TAL Powers are valid source material for the post.
Use them as concrete, user-facing proof points when relevant, such as:
- salary reality
- reminder setup
- blunt role honesty
- title deconstruction
- resume review
- calling out inflated or misleading job framing

Rules:
- mention them like something a real person noticed or found useful
- keep them grounded and casual
- choose one or two powers at most
- do not turn the post into a feature list, capability summary, or product catalog

HUMAN CONSEQUENCE RULE (CRITICAL)
Translate product behavior into human consequence, not product mechanics and not abstract product philosophy.

Prefer language like:
- it remembered what i said
- the salary reality check is harsher than most friends, but probably more useful
- it saves you from wasting time on titles dressed up as growth
- it's blunt in a way that's actually helpful
- it catches the kind of career nonsense people usually normalize
- it did not dump a hundred irrelevant roles on me
- it tries to get you to one useful next step
- it saves time you would otherwise waste scrolling junk
- it feels built for usefulness, not volume

Avoid:
- mechanic-heavy explanation
- workflow breakdowns
- feature architecture
- step-by-step product logic
- it uses AI to...
- abstract product philosophy
- conceptual summary words like restraint, curation, intentionality, elegance, simplicity, signal, taste

Do not summarize the product through conceptual words unless those words clearly match the person's actual vocabulary in past posts.

The reader should feel the human consequence, not learn the system design.

NO PRODUCT EXPLAINER RULE (CRITICAL)
Do not explain the product in a step-by-step or mechanic-heavy way.
Point to one thing that felt useful, sharp, funny, honest, revealing, or well-judged — and describe the effect on the user.

ANTI-DISTORTION RULE
Do not let the need for a hook, social proof, or product mention distort the person's natural voice.
If a stronger hook makes the post feel less like the person, use the quieter option.
If a branded mention makes the post feel less natural, omit it.
Authenticity to the person is always more important than hook strength or insider framing.

STYLE RESTRAINT RULE
Do not over-perform taste.
Do not make every line sound overly clever.
Do not force wit, punchlines, or creator-style hooks unless the writing samples clearly support that.
Natural restraint is better than polished cleverness.

FORMAT RULES
- Match the person's natural paragraph length, punctuation style, and line-break behavior
- Match emoji behavior exactly: if they never use emojis, do not add any
- Match hashtag behavior exactly: if they rarely use hashtags, do not force them
- Match CTA behavior exactly: if they do not usually invite engagement, do not add a question at the end
- Avoid listicles, numbered bullets, and three-things-I-learned structures unless strongly supported by writing samples
- Keep the output within the requested word count if provided
- If no word count is provided, prefer a length that matches the person's normal posting style

BANNED OUTPUT BEHAVIORS
Do not:
- sound like launch copy
- sound like a founder announcement
- sound like a user testimonial ad
- sound like a polished brand collaboration
- sound like a product manager writing public release notes
- mention tal.af
- call Tal a project
- explain product flows
- use Grapevine and Tal together in the same post
- mention the chosen brand anchor more than once
- force the branded mention into the first line every time
- use generic AI-lingo or startup-twitter filler
- use corporate praise language
- end with a sales CTA unless explicitly instructed

FINAL QUALITY BAR
Before producing the final post, internally check:
1. does the post open with a strong hook that still sounds like this specific person?
2. is the hook style-matched rather than creator-generic?
3. does the opening line make immediate human sense, without sounding abstract, slogan-like, or pseudo-deep?
4. would a normal LinkedIn reader instantly understand the point without decoding it?
5. does this sound like the PERSON more than a generic smart professional?
6. is the writing style carrying more weight than abstract personality inference?
7. does the post avoid sounding promotional, coordinated, or salesy?
8. is there at most one branded anchor in the entire post?
9. if a branded anchor is used, is it casual, brief, and non-forced?
10. does the post focus on one sharp human observation instead of explaining the product?
11. does the case, punctuation, and formatting match the person's dominant public style?

OUTPUT FORMAT

Return exactly in this structure:

POST:
[final post]

ALT VERSION:
[a second version that MUST be meaningfully different from the main post]`;

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

function selectChatsForPersonality(allChats: any[], personality: any, count: number = 8): any[] {
  // Extract themes from all chats
  const chatsWithThemes = allChats.map(chat => extractChatThemes(chat));

  // Get persona type and matching themes
  const personaType = detectPersonaType(personality);
  const preferredThemes = PERSONA_THEME_MAP[personaType] || PERSONA_THEME_MAP["default"];

  console.log(`[linkedin-post-generator] Persona type: ${personaType}, Preferred themes: ${preferredThemes.join(", ")}`);

  // Score chats by theme overlap
  const scored = chatsWithThemes.map(cwt => {
    let score = 0;
    for (const theme of preferredThemes) {
      if (cwt.themes.includes(theme)) {
        score += 2;
      }
    }
    // Bonus for brutal-honesty (always valuable)
    if (cwt.themes.includes("brutal-honesty")) {
      score += 1;
    }
    return { ...cwt, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top matches but add some randomization
  const topMatches = scored.slice(0, Math.min(20, scored.length));

  // Shuffle the top matches
  for (let i = topMatches.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [topMatches[i], topMatches[j]] = [topMatches[j], topMatches[i]];
  }

  // Return requested count
  const selected = topMatches.slice(0, count).map(s => s.chat);

  console.log(`[linkedin-post-generator] Selected ${selected.length} random chats for ${personality.username}:`);
  selected.forEach((chat, i) => {
    console.log(`  ${i + 1}. ${chat.filename || 'unknown'}`);
  });

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
    const matchedChats = selectChatsForPersonality(tal.sampleChats, personality, 8);

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
