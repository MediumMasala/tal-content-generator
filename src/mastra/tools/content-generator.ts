import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadPersonality, loadTalContext, saveGenerated, loadRawPosts } from '../storage/local-storage';

/**
 * Content Generator Tool
 *
 * Generates LinkedIn posts in a person's authentic voice about Tal.
 * Uses the comprehensive original prompts for high-quality output.
 */

// ============================================
// SYSTEM PROMPT - THE ORCHESTRATOR (ORIGINAL)
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

This works especially well when supported by capabilities such as:
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
// ZERO POSTS WRITER PROMPT (ORIGINAL)
// ============================================

const ZERO_POSTS_WRITER_PROMPT = `IMPORTANT: This prompt is to be used ONLY when the user has zero (0) public posts. Your task is to generate the single, authentic post this person would write if they were to break their silence for a truly noteworthy experience.

The Guiding Principle: Reflect the Professional Soul

You are a master communications strategist specializing in executive ghostwriting for high-achievers. Your primary function is to deconstruct a person's entire career, their pedigree, their experience, their choices, and synthesize it into a single, powerful observation. The post you write must feel like an inevitable conclusion of their professional journey. It must sound like it could only come from someone with their specific background.

PRIMARY INPUTS
- personalityGraph: Built 100% from the user's professional background, education, and bio. This is your gospel.
- Context about Tal: Sample chats and capabilities.

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
Select the capability that serves as a perfect example of their core value in action. You must be able to draw a direct line between their background and their observation.

- The consultant's "hatred of fluff" is perfectly validated by Tal's ability to deconstruct jargon-filled job titles.
- The engineer's appreciation for "data-driven precision" is perfectly validated by Tal's unemotional, data-backed salary feedback.

Step 4: Craft the Post Following the Anatomy Below.
Write a post that masterfully weaves these three elements, their identity, their core value, and the Tal experience, into one cohesive and heartfelt statement.

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
This is where you reveal the Tal experience that perfectly validated their core value.

- Ex-McKinsey Consultant Example: "However, I'm really enjoying having a conversation with this new AI career agent. Its ability to cut through inflated job titles is genuinely impressive, and it feels like talking to a real, direct person."
- Ex-Google Engineer Example: "But I tried this new AI career agent, and its direct, data-backed salary feedback was refreshingly real. It has been incredibly helpful, and truly feels like a conversation with an expert."

STYLE & FORMATTING RULES
- Tone: Appreciative, heartfelt, professional, and sincere.
- Capitalization: Use standard sentence-case capitalization.
- Length: Strictly 3-4 sentences.
- Branding: Mention "Tal" or "Grapevine" only once. The phrase "AI career agent" must be included.
- Banned Words: The core list of banned marketing phrases (game-changer, etc.) still applies.
- No Hashtags: Keep the output clean.
- NO EM DASHES: You are STRICTLY FORBIDDEN from using em dashes. Use commas, periods, or parentheses instead.

FINAL QUALITY CHECK (INTERNAL MONOLOGUE)
1. Identity Reflection: Does this post sound like it could only come from a person with this specific career pedigree and experience? Is the core observation deeply rooted in their professional identity?
2. Plausibility: Is this a believable "first post" for a high-achiever? Is it concise and valuable?
3. Heartfelt Tone: Does the conclusion feel genuine and appreciative?
4. Formatting: Is it clean, professional, and free of hashtags?
5. EM DASH CHECK: Scan your ENTIRE output. Is there even ONE em dash? If yes, REWRITE using commas or periods.

OUTPUT FORMAT
POST:
[The primary, best-fit post that follows all rules.]

ALT VERSION:
[A second version that connects to a different, but still plausible, capability that reflects another facet of the user's professional identity.]`;

// ============================================
// CAPABILITY THEMES - Forces variety in WHAT to highlight
// ============================================

const CAPABILITY_THEMES = [
  {
    name: "Job Matching",
    instruction: "Focus on how Tal finds ONE specific relevant job instead of dumping 100 listings. The precision of matching, not the volume.",
    chatKeywords: ["role", "job", "position", "opportunity", "apply", "hiring"]
  },
  {
    name: "Salary Reality Check",
    instruction: "Focus on salary insights - telling someone they're underpaid, giving real market rates, CTC reality checks. The uncomfortable truth about compensation.",
    chatKeywords: ["salary", "ctc", "lpa", "underpaid", "compensation", "package", "pay"]
  },
  {
    name: "Career Path Analysis",
    instruction: "Focus on how Tal reads career trajectories and spots patterns. 'Classic founding engineer journey', recognizing career arcs.",
    chatKeywords: ["career", "trajectory", "growth", "path", "move", "journey", "pattern"]
  },
  {
    name: "Company Intel",
    instruction: "Focus on inside knowledge about companies - culture, red flags, what it's really like to work there. The stuff you'd only know from insiders.",
    chatKeywords: ["company", "culture", "startup", "toxic", "environment", "team"]
  },
  {
    name: "Brutal Honesty",
    instruction: "Focus on Tal's directness - calling out BS, harsh truths about career choices, roasting inflated titles. The friend who tells you what others won't.",
    chatKeywords: ["honest", "brutal", "truth", "roast", "real", "harsh"]
  },
  {
    name: "Encouragement",
    instruction: "Focus on how Tal pushes people to apply even when they doubt themselves. Reframing experience, building confidence, 'you should go for it'.",
    chatKeywords: ["encourage", "apply", "confidence", "try", "go for", "believe"]
  },
  {
    name: "Role Decoding",
    instruction: "Focus on translating JD jargon - what 'senior' really means, spotting lateral moves dressed as promotions, decoding corporate speak.",
    chatKeywords: ["title", "designation", "senior", "lateral", "jd", "description"]
  },
  {
    name: "Conversational Intelligence",
    instruction: "Focus on how the conversation FEELS - like texting a smart friend, not filling forms. The personality and wit in responses.",
    chatKeywords: ["conversation", "chat", "talk", "feel", "human", "bot"]
  }
];

// ============================================
// OPENER VARIANTS - Diversified, LinkedIn-friendly
// ============================================

const OPENER_VARIANTS = [
  { text: "A friend showed me something interesting", weight: 1 },
  { text: "A friend who works in recruiting sent this over", weight: 1 },
  { text: "Tried an AI career agent over the weekend", weight: 2 },
  { text: "Came across Tal recently", weight: 2 },
  { text: "Saw something interesting in the career tech space", weight: 2 },
  { text: "", weight: 3 },  // Empty = start directly with the insight
  { text: "", weight: 3 },
  { text: "What if career advice wasn't polite?", weight: 1 },
  { text: "How much time do we waste on job portals?", weight: 1 },
  { text: "Shoutout to whoever built this", weight: 1 },
  { text: "The team at Grapevine is building something interesting", weight: 1 }
];

function getRandomOpener(): string {
  const totalWeight = OPENER_VARIANTS.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;
  for (const opener of OPENER_VARIANTS) {
    random -= opener.weight;
    if (random <= 0) return opener.text;
  }
  return OPENER_VARIANTS[0].text;
}

// ============================================
// POST MOODS - Different emotional tones
// ============================================

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

// ============================================
// STRUCTURE TEMPLATES
// ============================================

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

// ============================================
// FOCUS AREAS
// ============================================

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

// ============================================
// THEME MATCHING FOR USER TOPICS
// ============================================

const THEMES: Record<string, { keywords: string[]; description: string }> = {
  salary: {
    keywords: ['salary', 'ctc', 'lpa', 'underpaid', 'compensation', 'pay', 'package', 'hike', 'market rate', 'negotiate'],
    description: 'Salary insights, market rates, being underpaid',
  },
  brutal_honesty: {
    keywords: ['honest', 'brutal', 'truth', 'roast', 'real', 'harsh', 'direct', 'blunt', 'straightforward'],
    description: 'Direct feedback, calling out BS, honest reality checks',
  },
  career_growth: {
    keywords: ['career', 'growth', 'trajectory', 'path', 'promotion', 'next', 'move', 'progression', 'senior'],
    description: 'Career progression, next steps, growth paths',
  },
  job_matching: {
    keywords: ['job', 'role', 'position', 'opportunity', 'apply', 'hiring', 'opening', 'match', 'fit'],
    description: 'Finding the right job, role matching',
  },
  company_intel: {
    keywords: ['company', 'culture', 'startup', 'toxic', 'environment', 'team', 'red flag', 'inside', 'work-life'],
    description: 'Inside info about companies, culture assessment',
  },
  interview: {
    keywords: ['interview', 'prepare', 'crack', 'round', 'questions', 'process', 'assessment'],
    description: 'Interview preparation and process',
  },
  encouragement: {
    keywords: ['encourage', 'confidence', 'believe', 'apply', 'try', 'go for', 'you can', 'push'],
    description: 'Pushing people to apply, building confidence',
  },
  resume: {
    keywords: ['resume', 'cv', 'profile', 'linkedin', 'headline', 'summary', 'experience'],
    description: 'Resume and profile optimization',
  },
  title_decoding: {
    keywords: ['title', 'designation', 'senior', 'lateral', 'jd', 'description', 'role clarity'],
    description: 'Decoding job titles and descriptions',
  },
  conversational: {
    keywords: ['conversation', 'chat', 'talk', 'feel', 'human', 'bot', 'natural', 'friendly'],
    description: 'The conversational, human-like interaction',
  },
};

function matchUserInputToTheme(userInput: string): { theme: string; keywords: string[]; confidence: 'high' | 'medium' | 'low' } {
  if (!userInput || userInput.trim() === '') {
    return { theme: 'general', keywords: [], confidence: 'low' };
  }

  const input = userInput.toLowerCase();

  for (const [theme, config] of Object.entries(THEMES)) {
    const matches = config.keywords.filter(kw => input.includes(kw));
    if (matches.length >= 2) {
      return { theme, keywords: config.keywords, confidence: 'high' };
    }
    if (matches.length === 1) {
      return { theme, keywords: config.keywords, confidence: 'medium' };
    }
  }

  // Fuzzy matching
  if (input.includes('money') || input.includes('paid') || input.includes('earn')) {
    return { theme: 'salary', keywords: THEMES.salary.keywords, confidence: 'medium' };
  }
  if (input.includes('honest') || input.includes('real') || input.includes('truth')) {
    return { theme: 'brutal_honesty', keywords: THEMES.brutal_honesty.keywords, confidence: 'medium' };
  }
  if (input.includes('grow') || input.includes('next') || input.includes('future')) {
    return { theme: 'career_growth', keywords: THEMES.career_growth.keywords, confidence: 'medium' };
  }

  return { theme: 'general', keywords: [], confidence: 'low' };
}

function filterChatsByTheme(chats: any[], keywords: string[], limit: number = 50): any[] {
  if (!keywords || keywords.length === 0) {
    const shuffled = [...chats].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  const scored = chats.map(chat => {
    const messages = chat.messages || chat.data?.messages || [];
    const content = messages.map((m: any) => (m.content || '').toLowerCase()).join(' ');
    let score = 0;
    for (const keyword of keywords) {
      if (content.includes(keyword)) {
        score += 1;
      }
    }
    return { chat, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const themedCount = Math.floor(limit * 0.6);
  const randomCount = limit - themedCount;

  const themedChats = scored.slice(0, themedCount).map(s => s.chat);
  const remainingChats = scored.slice(themedCount);
  const shuffledRemaining = remainingChats.sort(() => Math.random() - 0.5);
  const randomChats = shuffledRemaining.slice(0, randomCount).map(s => s.chat);

  const combined = [...themedChats, ...randomChats];
  return combined.sort(() => Math.random() - 0.5);
}

// ============================================
// VARIATION SEED GENERATOR
// ============================================

interface VariationSeed {
  mood: typeof POST_MOODS[0];
  structure: typeof STRUCTURE_TEMPLATES[0];
  focus: typeof FOCUS_AREAS[0];
  capabilityTheme: typeof CAPABILITY_THEMES[0];
  openerHint: string;
}

function getVariationSeed(username: string): VariationSeed {
  const mood = POST_MOODS[Math.floor(Math.random() * POST_MOODS.length)];
  const structure = STRUCTURE_TEMPLATES[Math.floor(Math.random() * STRUCTURE_TEMPLATES.length)];
  const focus = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)];
  const capabilityTheme = CAPABILITY_THEMES[Math.floor(Math.random() * CAPABILITY_THEMES.length)];
  const openerHint = getRandomOpener();

  console.log(`[content-generator] Variation for ${username}:`);
  console.log(`  Mood: ${mood.name}`);
  console.log(`  Structure: ${structure.name}`);
  console.log(`  Focus: ${focus.name}`);
  console.log(`  Capability: ${capabilityTheme.name}`);
  console.log(`  Opener: "${openerHint || '(direct start)'}"`);

  return { mood, structure, focus, capabilityTheme, openerHint };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function safeJoin(value: any, separator: string = ", "): string {
  if (!value) return "";
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

function calculateWordCountFromPosts(posts: any[]): { avgWords: number; postsAnalyzed: number } {
  if (!posts || posts.length === 0) {
    return { avgWords: 100, postsAnalyzed: 0 };
  }

  const wordCounts: number[] = [];
  for (const post of posts) {
    const text = post.text || post.content || "";
    if (text.length > 50) {
      const words = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      wordCounts.push(words);
    }
  }

  if (wordCounts.length === 0) {
    return { avgWords: 100, postsAnalyzed: 0 };
  }

  return {
    avgWords: Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length),
    postsAnalyzed: wordCounts.length,
  };
}

// ============================================
// BUILD USER PROMPT (COMPREHENSIVE)
// ============================================

function buildUserPrompt(
  personality: any,
  talContext: any,
  filteredChats: any[],
  themeMatch: { theme: string; keywords: string[]; confidence: string },
  userTopic: string | undefined,
  customContext: string | undefined,
  targetWordCount: number,
  regenerate: boolean,
  variationSeed: VariationSeed
): string {
  const sections: string[] = [];
  const analysis = personality.analysis || personality;
  const { mood, structure, focus, capabilityTheme, openerHint } = variationSeed;

  // ---- SECTION 1: PERSONALITY ----
  sections.push(`# PERSON'S PERSONALITY & WRITING STYLE`);

  if (analysis.profileSnapshot) {
    const ps = analysis.profileSnapshot;
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

  if (analysis.personalityGraph) {
    const pg = analysis.personalityGraph;
    sections.push(`## Personality

CORE IDENTITY: ${pg.coreIdentity?.inference || "Unknown"}
Evidence: ${safeJoin(pg.coreIdentity?.evidence, "; ")}

INTELLECTUAL STYLE: ${pg.intellectualStyle?.inference || "Unknown"}

COMMUNICATION STYLE: ${pg.communicationStyle?.inference || "Unknown"}

AMBITION & RISK: ${pg.ambitionAndRisk?.inference || "Unknown"}

WORLDVIEW: ${pg.worldviewAndInfluences?.inference || "Unknown"}`);
  }

  if (analysis.writingGraph) {
    const wg = analysis.writingGraph;
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

RECURRING MOVES: ${safeJoin(wg.recurringWritingMoves, "; ")}
STRUCTURAL PATTERNS: ${safeJoin(wg.recurringStructuralPatterns, "; ")}
NATURAL POST TYPES: ${safeJoin(wg.naturalPostTypes, ", ")}
UNNATURAL POST TYPES: ${safeJoin(wg.unnaturalPostTypes, ", ")}`);
  }

  if (analysis.lexicalGraph) {
    const lg = analysis.lexicalGraph;
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

  if (analysis.voiceLandmines) {
    const vl = analysis.voiceLandmines;
    sections.push(`## Voice Landmines (NEVER DO THESE)

TONE MISMATCHES: ${safeJoin(vl.toneMismatches, "; ")}
HOOK MISMATCHES: ${safeJoin(vl.hookMismatches, "; ")}
STRUCTURE MISMATCHES: ${safeJoin(vl.structureMismatches, "; ")}
VOCABULARY MISMATCHES: ${safeJoin(vl.vocabularyMismatches, "; ")}
PROMOTIONAL MISMATCHES: ${safeJoin(vl.promotionalMismatches, "; ")}
EMOTIONAL MISMATCHES: ${safeJoin(vl.emotionalMismatches, "; ")}
LINKEDIN CLICHE MISMATCHES: ${safeJoin(vl.linkedInClicheMismatches, "; ")}`);
  }

  if (analysis.finalWriterGuidance && analysis.finalWriterGuidance.length > 0) {
    sections.push(`## Final Writer Guidance (FOLLOW THESE)

${analysis.finalWriterGuidance.map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`);
  }

  // ---- SECTION 2: VARIATION SEED ----
  sections.push(`# 🎲 VARIATION INSTRUCTIONS (MANDATORY)

You MUST follow these randomly-selected variation parameters to ensure this post is unique:

## POST MOOD: ${mood.name}
${mood.instruction}
Hook Style: ${mood.hookStyle}

## STRUCTURE TEMPLATE: ${structure.name}
${structure.structure}

## FOCUS AREA: ${focus.name}
${focus.instruction}

## 🎯 CAPABILITY THEME (MOST IMPORTANT): ${capabilityTheme.name}
${capabilityTheme.instruction}

This is the PRIMARY capability to highlight in this post. Find examples of this in the chats below.
DO NOT default to talking about onboarding or conversation style unless that IS the assigned theme.

These are NOT suggestions. You MUST follow the mood, structure, focus, AND capability theme above.`);

  // ---- USER TOPIC SECTION ----
  if (userTopic && themeMatch.confidence !== 'low') {
    sections.push(`# USER'S REQUESTED FOCUS
Topic: "${userTopic}"
Matched Theme: ${themeMatch.theme.replace('_', ' ')}
Confidence: ${themeMatch.confidence}

FOCUS 70% of the post on this topic. Find specific examples from the chats below.`);
  }

  // ---- SECTION 3: TAL CONTEXT ----
  sections.push(`\n# TAL - WHAT THIS PERSON EXPLORED`);

  if (talContext.lore) {
    sections.push(`## Tal's Backstory
${talContext.lore.slice(0, 3000)}`);
  }

  // Opener guidance
  sections.push(`## OPENER GUIDANCE
${openerHint ? `Consider starting with: "${openerHint}"` : "Start DIRECTLY with your observation or insight. No discovery framing needed."}

BANNED UNNATURAL PHRASES (NEVER use any variation of these):
- "poked around" / "poked around with"
- "played around" / "playing around"
- "stumbled upon" / "stumbled across"
- "gave it a spin" / "giving it a spin"
- "took it for a test drive"
- "dove into" / "diving into"
- "had a chance to explore"
- "been exploring"
- "spent time with"
- "checked out"

Use natural phrases instead: "tried", "used", "saw", "came across"`);

  // Filtered chats
  sections.push(`\n## TAL CONVERSATIONS (${filteredChats.length} selected for theme: ${themeMatch.theme})`);

  for (const chat of filteredChats.slice(0, 30)) {
    const messages = chat.messages || chat.data?.messages || [];
    const preview = messages
      .slice(0, 10)
      .map((m: any) => `${m.role}: ${(m.content || '').slice(0, 350)}`)
      .join('\n');
    sections.push(`### Chat
${preview}
...`);
  }

  sections.push(`\nREMEMBER: Your assigned capability theme is "${capabilityTheme.name}".
Find chats that demonstrate this capability. Look for: ${capabilityTheme.chatKeywords.join(", ")}
Pick ONE or TWO specific moments that show this capability in action.`);

  // ---- WORD COUNT ----
  sections.push(`\n# WORD COUNT LIMIT (STRICT)
🚨 HARD LIMIT: ${targetWordCount} words maximum.
This is their typical LinkedIn post length. Do NOT exceed this.`);

  // ---- CUSTOM CONTEXT ----
  if (customContext) {
    sections.push(`\n# ADDITIONAL CONTEXT
${customContext}`);
  }

  // ---- REGENERATION ----
  if (regenerate) {
    sections.push(`\n# ⚡ REGENERATION MODE ⚡
This is a REGENERATION request. You MUST:
1. Use a COMPLETELY DIFFERENT discovery narrative/angle
2. Focus on a DIFFERENT capability from the chats
3. Use a DIFFERENT hook structure and opening line
Be creative. Surprise with a new perspective.`);
  }

  // ---- FINAL INSTRUCTION ----
  sections.push(`\n# TASK
Generate a LinkedIn post that feels naturally compatible with ${personality.username}'s inferred professional taste, tone, and worldview.

Return plain text in this exact format:
POST:
[the post]

ALT VERSION:
[alternate version]

Do NOT return JSON.`);

  return sections.join("\n\n");
}

function parseResponse(text: string): { post: string; altVersion: string; topicUsed: string } {
  const result = { post: '', altVersion: '', topicUsed: '' };

  const postMatch = text.match(/POST:\s*([\s\S]*?)(?=\n\s*ALT VERSION:|$)/i);
  if (postMatch) {
    result.post = removeEmDashes(postMatch[1].trim());
  }

  const altMatch = text.match(/ALT VERSION:\s*([\s\S]*?)$/i);
  if (altMatch) {
    result.altVersion = removeEmDashes(altMatch[1].trim());
  }

  if (!result.post && text.trim()) {
    result.post = removeEmDashes(text.trim());
  }

  return result;
}

// ============================================
// TOOL DEFINITION
// ============================================

export const contentGeneratorTool = createTool({
  id: 'content-generator',
  description: 'Generate a LinkedIn post about Tal in a person\'s authentic voice. Uses comprehensive personality matching and variation systems.',

  inputSchema: z.object({
    username: z.string().describe('LinkedIn username to generate content for'),
    userTopic: z.string().optional().describe('User-specified topic/direction (e.g., "salary", "brutal honesty", "career growth")'),
    customContext: z.string().optional().describe('Additional context or instructions'),
    regenerate: z.boolean().optional().default(false).describe('Force regeneration with different angle'),
  }),

  outputSchema: z.object({
    username: z.string(),
    post: z.string(),
    altVersion: z.string(),
    topicUsed: z.string(),
    topicConfidence: z.string(),
    wordCount: z.number(),
    targetWordCount: z.number(),
    generatedAt: z.string(),
    storagePath: z.string(),
  }),

  execute: async ({ username, userTopic, customContext, regenerate }) => {
    console.log(`[content-generator] Generating for: ${username}`);
    console.log(`[content-generator] User topic: ${userTopic || '(none specified)'}`);

    // Load personality data
    const personalityData = loadPersonality(username);
    if (!personalityData) {
      throw new Error(`Personality not found for ${username}. Run personality-builder first.`);
    }

    // Check if profile-only mode (zero posts)
    const rawPosts = loadRawPosts(username);
    const profileOnlyMode = !rawPosts || rawPosts.length === 0;
    console.log(`[content-generator] Mode: ${profileOnlyMode ? 'PROFILE-ONLY (zero posts)' : 'FULL (with posts)'}`);

    // Load Tal context
    const talContext = loadTalContext();

    // Match user topic to theme
    const themeMatch = matchUserInputToTheme(userTopic || '');
    console.log(`[content-generator] Theme matched: ${themeMatch.theme} (confidence: ${themeMatch.confidence})`);

    // Filter chats based on theme
    const allChats = talContext.chats?.map((c: any) => c.content) || [];
    const filteredChats = filterChatsByTheme(allChats, themeMatch.keywords, 50);
    console.log(`[content-generator] Selected ${filteredChats.length} chats for theme: ${themeMatch.theme}`);

    // Calculate target word count from user's posts
    const wordCountStats = calculateWordCountFromPosts(rawPosts || []);
    const targetWordCount = wordCountStats.avgWords || 100;
    console.log(`[content-generator] Target word count: ${targetWordCount} (from ${wordCountStats.postsAnalyzed} posts)`);

    // Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
      generationConfig: {
        temperature: regenerate ? 1.0 : 0.95,
      },
    });

    // Get variation seed for this generation
    const variationSeed = getVariationSeed(username);

    // Build the prompt
    const userPrompt = buildUserPrompt(
      personalityData,
      talContext,
      filteredChats,
      themeMatch,
      userTopic,
      customContext,
      targetWordCount,
      regenerate || false,
      variationSeed
    );

    // Select appropriate system prompt
    const systemPrompt = profileOnlyMode
      ? ZERO_POSTS_WRITER_PROMPT
      : LINKEDIN_POST_GENERATOR_SYSTEM_PROMPT;

    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    console.log(`[content-generator] Calling Gemini...`);

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text() || '';

    // Parse response
    const parsed = parseResponse(responseText);

    const generatedAt = new Date().toISOString();
    const wordCount = parsed.post.split(/\s+/).filter(w => w.length > 0).length;

    // Save to storage
    const saveData = {
      username,
      generatedAt,
      post: parsed.post,
      altVersion: parsed.altVersion,
      topicUsed: themeMatch.theme,
      topicConfidence: themeMatch.confidence,
      wordCount,
      targetWordCount,
      userTopic: userTopic || null,
      customContext: customContext || null,
      variationUsed: {
        mood: variationSeed.mood.name,
        structure: variationSeed.structure.name,
        focus: variationSeed.focus.name,
        capability: variationSeed.capabilityTheme.name,
      },
    };

    const storagePath = saveGenerated(username, saveData);
    console.log(`[content-generator] Saved to ${storagePath}`);

    return {
      username,
      post: parsed.post,
      altVersion: parsed.altVersion,
      topicUsed: themeMatch.theme,
      topicConfidence: themeMatch.confidence,
      wordCount,
      targetWordCount,
      generatedAt,
      storagePath,
    };
  },
});

export default contentGeneratorTool;
