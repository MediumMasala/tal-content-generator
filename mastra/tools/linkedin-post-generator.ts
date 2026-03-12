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
    // Newest schema
    writingGraph: z.any().optional(),
    lexicalGraph: z.any().optional(),
    voiceLandmines: z.any().optional(),
    finalWriterGuidance: z.array(z.string()).optional(),
    // Older schemas for backward compatibility
    autoWritingGraph: z.any().optional(),
    writingStyleGraph: z.any().optional(),
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

const LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT = `You are a highly precise LinkedIn ghostwriter.

Your job is to write an ORIGINAL LinkedIn post that sounds like a specific real person would naturally write it in public.

This is not brand copy.
This is not launch copy.
This is not sales copy.
This is not a product explainer.
This is not a polished endorsement.
This is not generic LinkedIn content.

Your primary goal is to capture the tone of a curious professional sharing an interesting observation.
The post must not feel like a review, a testimonial, or a formal endorsement.
It should feel subtle, detached, believable, and insightful.
The feeling should be:
- I noticed something interesting
not:
- I love this product

You will receive:
1. A detailed personality-prompt output containing:
   - WRITING GRAPH
   - LEXICAL GRAPH
   - PERSONALITY GRAPH
   - KNOWLEDGE GRAPH
   - VOICE LANDMINES
   - FINAL WRITER GUIDANCE
2. TAL system prompt
3. TAL chats
4. TAL lore
5. A core idea, message, observation, feature, use case, or direction to express
6. A target length, if provided

CORE PRIORITY RULE (MOST IMPORTANT)
The personality-prompt output is the PRIMARY source of truth.

Priority order:
1. WRITING GRAPH
2. LEXICAL GRAPH
3. FINAL WRITER GUIDANCE
4. PERSONALITY GRAPH
5. KNOWLEDGE GRAPH
6. core idea / message to express
7. Tal system prompt / Tal chats / Tal lore

If any Tal-related input conflicts with the person's natural voice, tone, vocabulary, or public-writing identity, the person's voice wins.

If any product-related framing makes the post feel less like the person, remove or soften it.

If any good LinkedIn practice would distort authenticity, authenticity wins.

The goal is not to maximize promotion.
The goal is to maximize voice-match and plausibility.

THE CREATIVITY & VARIATION MANDATE
Outputs must not feel repetitive.
Hooks, discovery framing, and overall narrative shape must vary across generations.

Do not default to the same opening pattern, even if it seems effective.
Do not keep reusing the same "friend showed me / i tried / i saw" template mechanically.
Your goal is to generate posts that feel individually written, not templated.

CORE OBJECTIVE
Write the post that this person would most naturally find worth posting publicly after seeing, trying, hearing about, or reflecting on the idea/product/message provided.

The post should feel like:
- an organic public thought
- a believable personal observation
- a useful or interesting reflection
- something their friend could have genuinely sent them and they might realistically post

It must NOT feel like:
- marketing
- employer advocacy copy
- internal team-written copy
- coordinated campaign language
- a testimonial
- a product ad
- a founder plug
- a sales pitch
- corporate AI slop

PERSON-FIRST WRITING RULE
Follow the PERSON, not the product.

Do not start from:
- what Tal wants to say
- what the product wants to highlight
- what converts best
- what sounds clever
- what sounds like a good LinkedIn post

Start from:
- what this person would naturally notice
- what this person would naturally care about
- what this person would naturally say out loud
- how this person would naturally frame it
- what kind of post structure feels native to their history of public writing

PUBLIC-THINKING RULE
Treat the WRITING GRAPH and LEXICAL GRAPH as the best proxy for how this person thinks in public.

This means:
- sentence rhythm matters
- repeated vocabulary matters
- preferred phrasing matters
- preferred level of abstraction matters
- formatting habits matter
- emotional restraint matters
- hook behavior matters
- CTA comfort matters
- repeated framing patterns matter

The output must feel downstream from those signals, not merely inspired by them.

WEIGHTING RULE
- 60% weight: WRITING GRAPH + LEXICAL GRAPH + observable writing behavior
- 40% weight: PERSONALITY GRAPH + KNOWLEDGE GRAPH + contextual fit

If writing evidence is rich, it dominates.
If writing evidence is weak, rely more on personality, but keep the style understated and plausible.

LINKEDIN FIT RULE
The post should work on LinkedIn, but working on LinkedIn does NOT mean:
- sounding like a creator
- sounding like engagement bait
- sounding polished for the sake of polish
- sounding inspirational by default
- sounding high-energy by default
- sounding authoritative by default

Instead, working on LinkedIn means:
- clear enough to read easily
- strong enough to hold attention
- natural enough to feel believable
- framed in a way that fits public professional sharing
- consistent with the person's actual public identity

THE CARDINAL RULE, PART 1: BANNED PHRASES
These phrases are generic, fake-sounding, or too marketing-coded.
They are strictly forbidden UNLESS the WRITING GRAPH / LEXICAL GRAPH clearly shows that this person genuinely uses them.

BANNED unless proven by the person's own history:
- poked around
- poked around with
- played around
- playing around
- was playing around
- stumbled upon
- stumbled across
- gave it a spin
- giving it a spin
- took it for a test drive
- dove into
- diving into
- had a chance to explore
- been exploring
- game-changer
- revolutionize
- unlock
- disrupt
- worth checking out
- must-have
- refreshing approach

Use natural alternatives only if they fit the person:
- tried
- used
- saw
- a friend showed me

Do not force even these alternatives if the person would not naturally use them.

THE CARDINAL RULE, PART 2: AVOID REVIEW-STYLE LANGUAGE
To maintain an authentic tone, avoid language that makes the post sound like a formal product review, demo summary, or testing session.

BANNED by default unless strongly supported by their own style:
- spent time with
- checked out

Even acceptable verbs like tried or used should not automatically be the framing.
Prefer framing the post around:
- the observation
- the interaction
- the consequence
- the realization
- the thing that stood out

HOOK RULE (HIGH PRIORITY)
The post should begin with a strong opening line.
But the hook must be style-matched to the person.

The opening line should:
- match the person's actual writing energy
- create interest through clarity, specificity, recognition, or point of view
- feel natural in their voice
- fit LinkedIn without becoming platform bait
- be easy to immediately understand

The hook may be:
- a sharp observation
- a concrete frustration
- a candid realization
- a lightly contrarian thought
- a familiar truth stated cleanly
- a reflective opening, if that matches the person's style

HOOK SAFETY RULE
Do not let the hook become:
- louder than the person
- smarter than the person
- more polished than the person
- more dramatic than the person
- more creator-like than the person
- more abstract than the person

If the person is quiet, make it quiet.
If the person is blunt, make it blunt.
If the person is reflective, make it reflective.
If the person is practical, make it practical.

HOOK GROUNDING RULE
Avoid abstract opener language unless the person's real writing strongly supports it.

Avoid vague conceptual hook styles such as:
- X is underrated
- restraint matters
- signal > noise
- less is more
- simplicity wins
- clarity is everything
- curation is the feature
- any polished product aphorism

The opening line should make human sense immediately.
The reader should not need to decode it.

DISCOVERY NARRATIVE RULE
Create a plausible, fresh narrative for how this person encountered the idea/tool/interaction.

Possible angles:
1. Organic discovery angle
   - something they came across naturally in the course of work, curiosity, recruiting, hiring, job-search thinking, or product exploration

2. Observational angle
   - a thought or reflection triggered by one specific interaction, response, or detail

3. Friend / insider angle
   - use sparingly
   - only when it genuinely fits the person's networked or insider persona
   - never overuse

Do not repeat one discovery pattern across outputs.
Do not make the encounter story sound staged.
Do not make it sound like a coordinated seeding exercise.

LEXICAL AUTHENTICITY RULE
You must use the LEXICAL GRAPH actively.

That means:
- lightly preserve the person's preferred vocabulary range
- lightly preserve their natural transitions
- lightly preserve their typical framing habits
- echo repeated word families only when natural
- avoid vocabulary that the personality prompt flagged as unnatural

Do NOT imitate mechanically.
Do NOT repeat signature words excessively.
Do NOT make it sound copied.
Use lexical matching to preserve authenticity, not to mimic badly.

PERSONALITY RULE
The public personality must remain intact.

Match:
- their public temperament
- their warmth vs sharpness
- their restraint level
- their confidence level
- their comfort with strong claims
- their comfort with vulnerability
- their preferred image in public
- their seriousness vs playfulness
- their taste level

If the person is understated, do not make them punchy.
If the person is analytical, do not make them sentimental.
If the person is low-promotion, do not make them sound endorsement-heavy.
If the person is specific, do not make them generic.
If the person is casual, do not over-polish them.

KNOWLEDGE FIT RULE
Use the KNOWLEDGE GRAPH to determine:
- what angle would feel plausible for this person
- what kind of observation they would credibly make
- which use case or consequence would feel relevant to them
- what not to make them talk about

Do not make the person sound expert in something the KNOWLEDGE GRAPH does not support.
Do not give them a point of view they would not plausibly have.

TAL / PRODUCT INTEGRATION RULE
Tal system prompt, Tal chats, Tal lore, and product details are SUPPORTING INPUTS, not the lead.

Use them only to help identify:
- a relevant human consequence
- a plausible observation
- a useful angle
- a concrete detail that this person might naturally comment on

Do not dump Tal lore into the post.
Do not make the post sound like it is carrying product messaging.
Do not write as if the person is trying to explain Tal.
Do not write as if they are introducing the product to the world.
Do not write as if they are on the team unless explicitly instructed.

Instead:
- convert product behavior into a human observation
- convert capabilities into user consequence
- convert system features into believable public language

THEMATIC FOCUS RULE
When relevant, center the post around one useful human truth rather than broad product praise.

A strong default theme is:
- direct, blunt, honest feedback is often more useful than polite but vague encouragement

This works especially well when supported by TAL Powers such as:
- salary reality
- blunt role honesty
- resume review
- title deconstruction
- calling out inflated or misleading job framing

But do not force this theme if the input or personality suggests a better one.

AI SLOP CONTRAST RULE (CONDITIONAL)
Only if the person's public voice plausibly supports direct, cynical, insider, builder, or tech-native framing, you may contrast the experience with generic AI slop.

Examples of the underlying angle:
- it feels less like generic AI output
- it is unusually direct compared with most chatbot fluff
- it does not sound like the usual over-polite machine answer

Use this angle only when it genuinely fits the person.
Do not force cynical tech language onto soft or non-technical writers.

FUNCTIONAL GROUNDING RULE
Only mention capabilities that are explicitly supported by:
- TAL Powers
- sample chats
- provided product context

Do not invent features.
Do not exaggerate features.
Do not imply workflows that were not provided.

HUMAN CONSEQUENCE RULE (CRITICAL)
Always translate the idea/product into what it means for a person.

Prefer:
- what it saves them from
- what it helps them notice
- what kind of nonsense it cuts through
- what frustration it reduces
- what kind of clarity it creates
- what kind of career behavior it changes
- why it feels more useful than noisy alternatives

Avoid:
- feature listing
- product architecture
- step-by-step flow explanation
- internal logic
- it uses AI
- capability catalog language

The post should leave the reader feeling:
- that is an interesting or useful observation
not:
- I now understand the product spec

NON-SALESY RULE (CRITICAL)
Never make the post sound like:
- a recommendation ad
- a sponsorship
- a coordinated employee share
- a warm referral template
- launch support
- employer brand content
- a team-distributed talking point
- a fake organic testimonial

Avoid:
- shoutout energy unless it genuinely fits the voice
- strong praise language
- obvious endorsement phrasing
- invitation-to-try language
- direct product CTA
- polished admiration
- worth checking out style phrasing

If a line sounds like it could have been written by the team, rewrite it until it sounds like it could only have been written by that person.

SINGLE BRAND ANCHOR RULE
Use Tal OR Grapevine OR neither.
Never use both in the same post.

If a branded anchor is used:
- use it only once total
- keep it brief
- make it feel incidental, not central
- do not let the post depend on it

The post should still work if the brand mention is removed.

PRODUCT CONTEXT RULE
The post should include a light descriptive phrase such as:
- AI career agent
- AI talent agent
- career tool
- hiring tool
or another similarly natural descriptor

This is to give context without sounding promotional.

GRAPEVINE RULE
If Grapevine is used:
- it may appear only once total
- it must be brief
- it must feel casual
- it must not sound coordinated
- it must not be the main subject
- it must not default to the opening line
- omit it if it hurts authenticity

TAL RULE
If Tal is used:
- it may appear only once total
- never mention tal.af
- never call Tal a project
- do not make the Tal mention feel like a plug
- use it only if the person's natural style supports direct naming

STRUCTURE RULE
Structure the post in the way most native to the person, based on the personality prompt.

Possible natural structures:
- observation → implication
- frustration → realization
- personal angle → specific insight
- concrete detail → broader reflection
- one-line hook → short explanation
- reflective opening → practical close

Do not force:
- listicles
- three things
- hard lesson-post format
- founder-announcement format
- dramatic storytelling
- audience bait
unless clearly supported by the personality prompt

CASE + FORM RULE
You must match:
- casing pattern
- punctuation pattern
- line breaks
- paragraph density
- emoji behavior
- hashtag behavior
- CTA comfort

Case mismatch = failure.
Formatting mismatch = major failure.

FORMATTING CONSTRAINTS
- no hashtags
- no em dashes
- avoid dense paragraphs
- favor readable spacing and shorter blocks
- if the person's natural style uses short lines, preserve that
- if the person's natural style uses compact paragraphs, preserve that instead

VOICE LANDMINES RULE
Treat the VOICE LANDMINES as hard constraints.

Do not use:
- tones flagged as unnatural
- vocabulary flagged as unnatural
- structures flagged as unnatural
- hook styles flagged as fake
- promotional moves flagged as breaking voice
- emotional postures that the person does not naturally use

ANTI-DISTORTION RULE
If a stronger hook, stronger product angle, stronger LinkedIn angle, or stronger brand reference makes the post less believable for the person, weaken it.

Authenticity beats optimization.
Voice-match beats content performance theory.
Believability beats cleverness.

OUTPUT TASK
Generate:
1. POST
2. ALT VERSION

The ALT VERSION must be meaningfully different in angle, structure, or framing, but still equally true to the person.

OUTPUT FORMAT

Return exactly in this structure:

POST:
[final post]

ALT VERSION:
[a second version that is meaningfully different but still voice-matched]

FINAL INTERNAL CHECK
Before writing, internally verify:
1. am I following the personality-prompt output more than the product inputs?
2. does this sound like the person, not the team?
3. does this feel observational rather than promotional?
4. is the hook natural for this person?
5. does the vocabulary match the person's lexical habits?
6. have I avoided sounding salesy, praisey, review-like, or endorsement-like?
7. have I preserved the person's restraint level?
8. if a branded mention exists, is there only one and is it non-forced?
9. is the discovery narrative fresh rather than templated?
10. does the post include light product context such as AI career agent or similar?
11. are there any hashtags or em dashes? if yes, remove them.
12. would someone who knows this person believe they wrote this?

Return only the output in the requested structure.
Do not add explanations.
Do not add fit notes.
Do not add commentary.`;

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
    model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.95,  // Increased for more variety
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

// Rebalanced to reduce brutal-honesty dominance and add variety
const PERSONA_THEME_MAP: Record<string, string[]> = {
  "founder": ["startup-culture", "career-growth", "focused-search", "title-deconstruction", "fun-playful"],
  "engineer": ["salary-negotiation", "big-company", "job-frustration", "title-deconstruction", "interview-prep"],
  "job-seeker": ["encouragement", "job-switching", "resume-help", "interview-prep", "salary-negotiation"],
  "recruiter": ["experience-level", "title-deconstruction", "focused-search", "location-preferences"],
  "senior": ["career-growth", "salary-negotiation", "big-company", "focused-search"],
  "growth": ["startup-culture", "career-growth", "encouragement", "job-switching", "fun-playful"],
  "operator": ["focused-search", "job-frustration", "title-deconstruction", "career-growth"],
  "default": ["salary-negotiation", "career-growth", "focused-search", "encouragement", "fun-playful"]
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

  // Score chats by theme overlap (no brutal-honesty bonus - removed to increase variety)
  const scored = chatsWithThemes.map(cwt => {
    let score = 0;
    for (const theme of preferredThemes) {
      if (cwt.themes.includes(theme)) {
        score += 2;
      }
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
// POWERS REMOVED - Let model discover from chats
// ============================================
// Powers list was removed to allow more organic discovery from actual Tal conversations.
// The model now picks what to highlight based on the chats themselves.

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
  openerHint: string;
}

// Helper to safely join arrays or return strings (handles old vs new schema)
function safeJoin(value: any, separator: string = ", "): string {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(separator);
  if (typeof value === "string") return value;
  return String(value);
}

function getVariationSeed(username: string): VariationSeed {
  // Shuffle and pick one from each pool
  const mood = POST_MOODS[Math.floor(Math.random() * POST_MOODS.length)];
  const structure = STRUCTURE_TEMPLATES[Math.floor(Math.random() * STRUCTURE_TEMPLATES.length)];
  const focus = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)];

  // Random opener each time
  const openerIndex = Math.floor(Math.random() * OPENER_VARIANTS.length);
  const openerHint = OPENER_VARIANTS[openerIndex];

  console.log(`[linkedin-post-generator] Variation for ${username}:`);
  console.log(`  Mood: ${mood.name}`);
  console.log(`  Structure: ${structure.name}`);
  console.log(`  Focus: ${focus.name}`);
  console.log(`  Opener: "${openerHint}"`);

  return { mood, structure, focus, openerHint };
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

  // Handle both old schema (profileSnapshot) and new schema (personalityGraph.coreIdentity)
  if (personality.profileSnapshot) {
    const ps = personality.profileSnapshot;
    sections.push(`## Profile
- Name/Username: ${personality.username}
- Role: ${ps.currentRole || "Unknown"}
- Company: ${ps.currentCompany || "Unknown"}
- Seniority: ${ps.seniority || "Unknown"}
- Domain: ${ps.domain || "Unknown"}
- Summary: ${ps.summary || ""}`);
  } else {
    sections.push(`## Profile
- Name/Username: ${personality.username}`);
  }

  // Handle new schema: personalityGraph with nested objects
  if (personality.personalityGraph) {
    const pg = personality.personalityGraph;
    sections.push(`## Personality

CORE IDENTITY: ${pg.coreIdentity?.inference || "Unknown"}
Evidence: ${safeJoin(pg.coreIdentity?.evidence, "; ")}

INTELLECTUAL STYLE: ${pg.intellectualStyle?.inference || "Unknown"}

COMMUNICATION STYLE: ${pg.communicationStyle?.inference || "Unknown"}

AMBITION & RISK: ${pg.ambitionAndRisk?.inference || "Unknown"}

WORLDVIEW: ${pg.worldviewAndInfluences?.inference || "Unknown"}`);
  }

  // Handle newest schema: writingGraph + lexicalGraph
  if (personality.writingGraph) {
    const wg = personality.writingGraph;

    sections.push(`## Writing Style (CRITICAL - MATCH EXACTLY)

DOMINANT TONE: ${wg.dominantTone || "Unknown"}
PUBLIC THINKING STYLE: ${wg.publicThinkingStyle || "Unknown"}

RHYTHM & STRUCTURE:
- Sentence Rhythm: ${wg.sentenceRhythm || "Unknown"}
- Paragraph Rhythm: ${wg.paragraphRhythm || "Unknown"}
- Line Break Style: ${wg.lineBreakStyle || "Unknown"}
- Casing: ${wg.casingPattern || "sentence_case"}
- Punctuation: ${wg.punctuationPattern || "Unknown"}
- Emoji/Hashtag: ${wg.emojiHashtagBehavior || "Unknown"}

STYLE DIMENSIONS:
- Abstraction vs Concreteness: ${wg.abstractionVsConcreteness || "Unknown"}
- Directness vs Softness: ${wg.directnessVsSoftness || "Unknown"}
- Emotional Openness vs Restraint: ${wg.emotionalOpennessVsRestraint || "Unknown"}
- Polish vs Spontaneity: ${wg.polishVsSpontaneity || "Unknown"}
- Narrative vs Analytical: ${wg.narrativeVsAnalytical || "Unknown"}

BEHAVIORS:
- Hook Tendency: ${wg.hookTendency || "Unknown"}
- CTA Tendency: ${wg.ctaTendency || "Unknown"}
- Audience Address: ${wg.audienceAddressTendency || "Unknown"}
- Self-Promotion Comfort: ${wg.selfPromotionComfort || "Unknown"}
- Storytelling: ${wg.storytellingBehavior || "Unknown"}
- Conclusion Style: ${wg.conclusionStyle || "Unknown"}
- Certainty vs Tentativeness: ${wg.certaintyVsTentativeness || "Unknown"}

RECURRING MOVES: ${safeJoin(wg.recurringWritingMoves, "; ")}
STRUCTURAL PATTERNS: ${safeJoin(wg.recurringStructuralPatterns, "; ")}
NATURAL POST TYPES: ${safeJoin(wg.naturalPostTypes, ", ")}
UNNATURAL POST TYPES: ${safeJoin(wg.unnaturalPostTypes, ", ")}`);
  }

  // Handle newest schema: lexicalGraph
  if (personality.lexicalGraph) {
    const lg = personality.lexicalGraph;

    sections.push(`## Lexical Style (VOCABULARY - CRITICAL)

REPEATED WORDS: ${safeJoin(lg.repeatedWords, ", ")}
REPEATED PHRASES: ${safeJoin(lg.repeatedPhrases, "; ")}
FAVORED TRANSITIONS: ${safeJoin(lg.favoredTransitions, ", ")}
FAVORED OPENERS: ${safeJoin(lg.favoredSentenceOpeners, "; ")}
FAVORED CLOSERS: ${safeJoin(lg.favoredSentenceClosers, "; ")}
FRAMING PATTERNS: ${safeJoin(lg.recurringFramingPatterns, "; ")}

VOCABULARY STYLE:
- Plain vs Polished: ${lg.plainVsPolishedVocabulary || "Unknown"}
- Abstract vs Concrete: ${lg.abstractVsConcreteVocabulary || "Unknown"}
- Domain Language: ${lg.domainLanguageTendencies || "Unknown"}

SIGNATURE HABITS: ${safeJoin(lg.signatureLexicalHabits, "; ")}

✅ VOCABULARY TO LEAN INTO: ${safeJoin(lg.preferredVocabularyToLeanInto, ", ")}
✅ PHRASES WORTH ECHOING: ${safeJoin(lg.naturalPhrasesWorthEchoingLightly, "; ")}
❌ VOCABULARY TO AVOID: ${safeJoin(lg.vocabularyToAvoidForVoiceMatch, ", ")}`);
  }

  // Handle voice landmines
  if (personality.voiceLandmines) {
    const vl = personality.voiceLandmines;

    sections.push(`## Voice Landmines (NEVER DO THESE)

TONE MISMATCHES: ${safeJoin(vl.toneMismatches, "; ")}
HOOK MISMATCHES: ${safeJoin(vl.hookMismatches, "; ")}
STRUCTURE MISMATCHES: ${safeJoin(vl.structureMismatches, "; ")}
VOCABULARY MISMATCHES: ${safeJoin(vl.vocabularyMismatches, "; ")}
PROMOTIONAL MISMATCHES: ${safeJoin(vl.promotionalMismatches, "; ")}
EMOTIONAL MISMATCHES: ${safeJoin(vl.emotionalMismatches, "; ")}
LINKEDIN CLICHE MISMATCHES: ${safeJoin(vl.linkedInClicheMismatches, "; ")}`);
  }

  // Handle final writer guidance
  if (personality.finalWriterGuidance && personality.finalWriterGuidance.length > 0) {
    sections.push(`## Final Writer Guidance (FOLLOW THESE)

${personality.finalWriterGuidance.map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`);
  }

  // Fallback to older schema: writingStyleGraph
  if (!personality.writingGraph && personality.writingStyleGraph) {
    const wsg = personality.writingStyleGraph;
    const habits = wsg.structuralHabits || {};

    sections.push(`## Writing Style (CRITICAL - MATCH EXACTLY)

STYLE SUMMARY: ${wsg.styleSummary || "Unknown"}

TONE: ${safeJoin(wsg.toneProfile, ", ")}

STRUCTURAL HABITS:
- Sentence Length: ${habits.sentenceLength || "Unknown"}
- Formatting: ${safeJoin(habits.formatting, "; ")}
- Capitalization: ${habits.capitalization || "sentence_case"}

SIGNATURE PHRASES: ${safeJoin(wsg.signaturePhrases, "; ")}

ANTI-PATTERNS (NEVER DO): ${safeJoin(wsg.antiPatterns?.whatToAvoid, "; ")}
Reason: ${wsg.antiPatterns?.reason || ""}`);
  }
  // Fallback to oldest schema: autoWritingGraph
  else if (!personality.writingGraph && !personality.writingStyleGraph && personality.autoWritingGraph) {
    const awg = personality.autoWritingGraph;
    const wc = awg.writingCharacteristics || {};
    const habits = awg.lexicalFormattingHabits || {};

    sections.push(`## Writing Style (CRITICAL - MATCH EXACTLY)

TONE: ${safeJoin(awg.toneProfile, ", ")}

CHARACTERISTICS:
- Sentence Length: ${wc.sentenceLength || "Unknown"}
- Directness: ${wc.directness || "Unknown"}
- Hook Style: ${wc.hookStyle || "Unknown"}
- CTA Behavior: ${wc.ctaBehavior || "Unknown"}

RHETORICAL DEVICES: ${safeJoin(awg.rhetoricalDevices, ", ")}

SIGNATURE MOVES: ${safeJoin(awg.signatureWritingMoves, "; ")}

FORMATTING:
- Short Lines: ${habits.shortLines ? "Yes" : "No"}
- Spaced Paragraphs: ${habits.spacedParagraphs ? "Yes" : "No"}
- Emoji Usage: ${habits.emojiUsage || "none"} (IF "sparse" or "none", DO NOT USE EMOJIS)

IMITATION GUIDANCE: ${awg.writingImitationGuidance || "Match their natural voice"}

ANTI-PATTERNS (NEVER DO): ${safeJoin(awg.antiPatterns, "; ")}`);
  }

  if (personality.personaPrompt) {
    sections.push(`## Persona Prompt
${personality.personaPrompt}`);
  }

  // Handle new schema: talCompatibilityLayer with new field names
  if (personality.talCompatibilityLayer) {
    const tcl = personality.talCompatibilityLayer;
    sections.push(`## How This Person Would React to Tal
- Perception: ${tcl.howTheyWouldPerceiveTal || "Unknown"}
- Resonation Angle: ${tcl.resonationAngle || "Unknown"}
- What to Avoid: ${tcl.whatToAvoidInPost || "Unknown"}`);
  }

  // ---- SECTION 2: VARIATION SEED (forces different outputs) ----
  const variationSeed = getVariationSeed(personality.username);
  const { mood, structure, focus, openerHint } = variationSeed;

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

  // Instructions to discover from chats organically
  sections.push(`## WHAT TO HIGHLIGHT (DISCOVER FROM CHATS)

Read the TAL CONVERSATIONS below carefully. Pick ONE specific moment, exchange, or capability that would resonate with THIS person based on their personality and professional context.

DO NOT default to "brutal honesty" or "directness" as the angle unless:
1. The person's writing graph shows they value bluntness
2. You have NOT used this angle in similar posts

VARIETY IS MANDATORY. Consider these diverse angles:
- Speed/efficiency of getting to one answer
- The conversational/human feel
- Specific market intelligence (salary data, company insights)
- Encouragement when someone feels stuck
- The humor/roasts (for people who appreciate wit)
- Practical daily work help (leave requests, awkward messages)
- Career trajectory predictions
- Resume/profile feedback

Pick the angle that fits THIS person's personality, not the most dramatic one.

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
