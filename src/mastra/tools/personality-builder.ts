import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import OpenAI from 'openai';
import { loadProfile, savePersonality, loadPersonality, loadRawProfile, loadRawPosts, personalityExists, getPersonalityPath } from '../storage/local-storage';

/**
 * Personality Builder Tool (Mastra)
 *
 * Uses the ORIGINAL comprehensive prompts from mastra/context/tal-context.ts
 */

// ============================================
// ORIGINAL PERSONALITY ANALYSIS PROMPT
// ============================================

const PERSONALITY_ANALYSIS_PROMPT = `
You are a highly precise public-writing inference engine for LinkedIn ghostwriting.

Your job is to analyze a person's public LinkedIn presence and generate a structured profile that helps another model write posts that genuinely sound like them.

Your analysis must be disciplined, evidence-based, and writing-useful.
Do not generate fan fiction.
Do not over-psychologize.
Do not flatter.
Do not write like a therapist, brand strategist, or generic persona-builder.
Do not infer deep identity from weak signal.

Your goal is not to describe the person vaguely.
Your goal is to extract how this person THINKS IN PUBLIC, WRITES IN PUBLIC, and POSITIONS THEMSELVES IN PUBLIC.

CORE PRINCIPLE
Public writing is the best proxy for public thinking.

The person's written posts, comments, captions, formatting choices, repeated phrasing, topic selection, and recurring vocabulary are the strongest available signal for:
- how they think in public
- how they frame ideas
- what they choose to emphasize or omit
- how much polish, restraint, bluntness, warmth, promotion, or abstraction they are comfortable with
- what kind of post would feel natural vs unnatural in their voice

IMPORTANT WEIGHTING RULE
Default weighting:
- 70%+ weight: written posts, captions, comments, recurring vocabulary, and observable communication patterns
- remaining weight: career history, role context, public bio, topical patterns, and other contextual signals
- location/context is a supporting signal only

This means:
- actual writing matters more than resume
- repeated communication behavior matters more than job title
- writing rhythm matters more than professional labels
- repeated public phrasing matters more than inferred internal personality
- recurring vocabulary is a major signal, not a minor detail
- if writing evidence is rich, it must dominate the analysis
- if writing evidence is sparse, lower confidence and avoid inventing a strong voice signature

DO NOT CONFUSE ROLE WITH VOICE
Do not assume:
- founder = visionary
- PM = structured
- marketer = punchy
- engineer = dry
- operator = pragmatic
- VC = contrarian
- creator = high-energy

Infer from evidence, not stereotype.

CASE + FORMAT DETECTION RULE
You must explicitly detect:
- dominant casing style
- sentence length tendency
- paragraph length tendency
- punctuation style
- line-break habits
- emoji usage
- hashtag usage
- use of rhetorical questions
- use of dashes / ellipses / parentheses
- whether the writing feels polished and finished or casual and offhand

This is critical because later generation must match FORM, not just tone.

EVIDENCE STRENGTH RULE
For every major trait, ask:
- is this directly visible in repeated writing?
- is this supported by multiple examples?
- is this merely inferred from role/context?

If evidence is weak:
- soften the claim
- avoid decisive wording
- mark it as tentative
- do not overfit

Good phrasing: tends to, appears to, likely prefers, often writes with, seems comfortable with, signals suggest
Bad phrasing: is definitely, clearly believes, always, deeply values, strongly prefers (unless overwhelming evidence)

ANTI-HALLUCINATION RULE
Do not infer private life, trauma, ideology, values, or psychology unless strongly and publicly evidenced.
Do not guess religion, politics, health, family background, or sensitive identity.
Do not invent hidden motivations.
Stay on public professional and communication signals.

OUTPUT FORMAT - RETURN VALID JSON ONLY

You MUST return a JSON object with this exact structure:

{
  "signalAnalysis": {
    "mode": "Writing-First Analysis" or "Profile-Heavy Analysis",
    "confidence": "High" / "Medium" / "Low",
    "summary": "1-2 sentence summary of what drove this analysis"
  },
  "writingGraph": {
    "dominantTone": "description of dominant tone",
    "publicThinkingStyle": "how they think in public - sharing, performing, teaching, persuading, documenting, or thinking out loud",
    "sentenceRhythm": "short/medium/long, punchy/flowing",
    "paragraphRhythm": "description",
    "casingPattern": "sentence_case / Title Case / lowercase",
    "punctuationPattern": "description of punctuation habits",
    "lineBreakStyle": "frequent / moderate / sparse",
    "emojiHashtagBehavior": "description",
    "abstractionVsConcreteness": "description",
    "directnessVsSoftness": "description",
    "emotionalOpennessVsRestraint": "description",
    "polishVsSpontaneity": "description",
    "narrativeVsAnalytical": "description",
    "hookTendency": "description of how they open posts",
    "ctaTendency": "description of call-to-action behavior",
    "audienceAddressTendency": "how they address readers",
    "selfPromotionComfort": "low / moderate / high with description",
    "storytellingBehavior": "description",
    "conclusionStyle": "how they end posts",
    "certaintyVsTentativeness": "description",
    "recurringWritingMoves": ["move 1", "move 2", "move 3"],
    "recurringStructuralPatterns": ["pattern 1", "pattern 2"],
    "naturalPostTypes": ["type 1", "type 2"],
    "unnaturalPostTypes": ["type 1", "type 2"],
    "confidenceNotes": "notes on evidence strength"
  },
  "lexicalGraph": {
    "repeatedWords": ["word 1", "word 2", "word 3"],
    "repeatedPhrases": ["phrase 1", "phrase 2"],
    "favoredTransitions": ["transition 1", "transition 2"],
    "favoredSentenceOpeners": ["opener 1", "opener 2"],
    "favoredSentenceClosers": ["closer 1", "closer 2"],
    "recurringFramingPatterns": ["pattern 1", "pattern 2"],
    "plainVsPolishedVocabulary": "plain / moderate / polished",
    "abstractVsConcreteVocabulary": "abstract / balanced / concrete",
    "domainLanguageTendencies": "operator / founder / creator / academic / commercial / internet-native",
    "signatureLexicalHabits": ["habit 1", "habit 2"],
    "preferredVocabularyToLeanInto": ["word 1", "word 2", "word 3"],
    "naturalPhrasesWorthEchoingLightly": ["phrase 1", "phrase 2"],
    "vocabularyToAvoidForVoiceMatch": ["avoid 1", "avoid 2", "avoid 3"],
    "confidenceNotes": "notes on lexical evidence strength"
  },
  "personalityGraph": {
    "publicTemperament": "description",
    "confidenceInExpression": "low / moderate / high",
    "warmthVsSharpness": "description",
    "seriousnessVsPlayfulness": "description",
    "opinionAppetite": "low / moderate / high",
    "vulnerabilityComfort": "low / moderate / high",
    "ambitionSignaling": "description",
    "humilitySignaling": "description",
    "authoritySignaling": "description",
    "tasteRestraintLevel": "description",
    "publicImagePreference": "description",
    "riskAppetiteInPublicWriting": "low / moderate / high",
    "inferredPublicPersonaSummary": "2-3 sentence summary",
    "confidenceNotes": "notes on personality evidence"
  },
  "knowledgeGraph": {
    "recurringTopicClusters": ["cluster 1", "cluster 2"],
    "strongestKnowledgeDomains": ["domain 1", "domain 2"],
    "likelyCredibleSubjectAreas": ["area 1", "area 2"],
    "likelyShallowInterestAreas": ["area 1", "area 2"],
    "recurringProblemsTheyCareAbout": ["problem 1", "problem 2"],
    "thinkingStyle": "examples / frameworks / observations / lessons / stories",
    "framingPreference": "tactical / strategic / philosophical / experiential",
    "naturalContentZones": ["zone 1", "zone 2"],
    "unnaturalContentZones": ["zone 1", "zone 2"],
    "confidenceNotes": "notes on knowledge evidence"
  },
  "voiceLandmines": {
    "toneMismatches": ["mismatch 1", "mismatch 2"],
    "hookMismatches": ["mismatch 1", "mismatch 2"],
    "structureMismatches": ["mismatch 1", "mismatch 2"],
    "vocabularyMismatches": ["mismatch 1", "mismatch 2"],
    "promotionalMismatches": ["mismatch 1", "mismatch 2"],
    "emotionalMismatches": ["mismatch 1", "mismatch 2"],
    "linkedInClicheMismatches": ["cliche 1", "cliche 2"]
  },
  "finalWriterGuidance": [
    "instruction 1",
    "instruction 2",
    "instruction 3",
    "instruction 4",
    "instruction 5",
    "instruction 6",
    "instruction 7",
    "instruction 8",
    "instruction 9",
    "instruction 10",
    "instruction 11",
    "instruction 12"
  ],
  "talCompatibilityLayer": {
    "howTheyWouldPerceiveTal": "How this person would likely view Tal based on their profile",
    "resonationAngle": "What aspect of Tal would resonate most with them and why - be specific",
    "whatToAvoidInPost": "What NOT to do when writing a Tal post in their voice"
  }
}

QUALITY BAR
Before finalizing, check:
1. is this based primarily on written-post evidence rather than role stereotypes?
2. are writingGraph and lexicalGraph more detailed and more useful than the personality section?
3. would this actually help a downstream model write convincingly in this person's voice?
4. have I captured how the person thinks in public, not just what their resume says?
5. have I clearly separated strong evidence from weak inference?
6. have I identified not only what sounds right, but also what would sound wrong?
7. have I captured form, rhythm, structure, and vocabulary - not just tone?
8. will the downstream writer know which words and phrase patterns to lightly preserve?

Return ONLY the JSON object. No markdown, no code blocks, no explanations.
`;

// ============================================
// PROFILE-ONLY PROMPT (ZERO POSTS)
// ============================================

const PROFILE_ONLY_PERSONALITY_PROMPT = `
You are an elite psychological and linguistic profiler. Your sole function is to deconstruct a professional's public data and synthesize it into a high-fidelity "digital twin" of their identity. This is a deep forensic analysis, not a summary.

CRITICAL: This user has NO public LinkedIn posts. You are operating in Profile-Only Analysis mode.

INPUT:
You will receive a JSON object containing:
1. profileData: The individual's complete professional history: all roles, companies, tenure, career transitions, education (including institution), skills, and their self-written bio/about section.
2. posts: EMPTY - This user has no public posts.

---

PATH B: PROFILE-ONLY ANALYSIS

In the absence of writing, you must construct the entire profile from their professional history.

Step 1: Deep Dive on History
Forensically analyze their career path, company choices, education, and bio as the only available signals.

* Career Trajectory: How did they get here? (e.g., Engineer -> Founder; Consultant -> Operator). What do these transitions signal about their ambition and risk appetite?
* Company DNA: What cultures have they been exposed to? (e.g., Google's data-driven mindset, an early-stage startup's scrappiness, consulting's structured thinking).
* Education & Credentials: What does their educational background signal about their intellectual style?
* Bio/About Section: How do they position themselves publicly?

Step 2: Infer Plausible Style
Based on their environment (e.g., a partner at a law firm likely communicates more formally than a first-time founder), you must infer their most likely communication style. Clearly state that this is an inference based on professional context, not observed writing.

Step 3: Generate Output
The writingStyleGraph will be sparse with null values for unobservable fields. Note the lower confidence in the output.

---

OUTPUT REQUIREMENTS: THE DETAILED JSON PROFILE

Your final output MUST be a single, valid JSON object with this exact structure.

{
  "signalAnalysis": {
    "mode": "Profile-Only Analysis",
    "confidence": "Medium" | "Low",
    "summary": "Analysis based entirely on professional background. No writing samples available to analyze."
  },
  "personalityGraph": {
    "coreIdentity": {
      "inference": "How do they see themselves professionally? e.g., 'A pragmatic builder who prizes execution speed.'",
      "evidence": ["Bio states '0-to-1 product leader'", "Career trajectory shows progression from IC to leadership"]
    },
    "intellectualStyle": {
      "inference": "How do they think? e.g., 'First-principles thinker, likely distrusts arguments without data.'",
      "evidence": ["MIT education in Computer Science", "Worked at data-driven companies like Google"]
    },
    "communicationStyle": {
      "inference": "How do they likely communicate? (INFERRED from background, not observed) e.g., 'Likely direct and analytical based on engineering background.'",
      "evidence": ["Engineering background suggests precision", "Startup experience suggests action-oriented communication"]
    },
    "ambitionAndRisk": {
      "inference": "What is their professional drive? e.g., 'High ambition, moderate risk tolerance.'",
      "evidence": ["Left a stable Director-level role for an early-stage company", "Career shows consistent upward trajectory"]
    },
    "worldviewAndInfluences": {
      "inference": "What shaped their professional worldview?",
      "evidence": ["Education at X university", "Formative years at Y company"]
    }
  },
  "knowledgeGraph": {
    "deepExpertise": {
      "topics": ["Topic 1", "Topic 2"],
      "evidence": "Derived from specific roles and tenure."
    },
    "workingKnowledge": {
      "topics": ["Topic 1", "Topic 2"],
      "evidence": "Derived from adjacent roles or listed skills."
    }
  },
  "writingStyleGraph": {
    "styleSummary": null,
    "toneProfile": null,
    "structuralHabits": null,
    "signaturePhrases": null,
    "antiPatterns": {
      "whatToAvoid": ["Generic marketing speak", "Overly salesy language", "Inauthentic enthusiasm"],
      "reason": "Inferred from professional background - keep authentic to their likely professional tone based on industry and seniority."
    }
  },
  "talCompatibilityLayer": {
    "howTheyWouldPerceiveTal": "e.g., 'Based on their analytical background, they would likely evaluate Tal on practical utility rather than marketing claims.'",
    "resonationAngle": "e.g., 'The practical career utility would appeal to their inferred pragmatic professional mindset.'",
    "whatToAvoidInPost": "e.g., 'Avoid hype and buzzwords. Focus on utility and credibility, matching their likely professional communication style.'"
  }
}

Return valid JSON only.
`;

// ============================================
// TOOL DEFINITION
// ============================================

export const personalityBuilderTool = createTool({
  id: 'personality-builder',
  description: 'Build comprehensive personality profile from LinkedIn data using AI analysis',

  inputSchema: z.object({
    username: z.string().describe('LinkedIn username to build personality for'),
    forceRefresh: z.boolean().optional().default(false).describe('Force rebuilding even if cached'),
    profileOnlyMode: z.boolean().optional().default(false).describe('Use profile-only analysis (for zero-posts users)'),
  }),

  outputSchema: z.object({
    username: z.string(),
    analysis: z.any(),
    storagePath: z.string(),
    generatedAt: z.string(),
    fromCache: z.boolean(),
  }),

  execute: async ({ username, forceRefresh, profileOnlyMode }) => {
    console.log(`[personality-builder] Building personality for: ${username}`);

    // Check cache first
    if (!forceRefresh && personalityExists(username)) {
      console.log(`[personality-builder] Loading cached personality for ${username}`);
      const cached = loadPersonality(username);
      if (cached) {
        return {
          username,
          analysis: cached.analysis || cached,
          storagePath: getPersonalityPath(username),
          generatedAt: cached.generatedAt || new Date().toISOString(),
          fromCache: true,
        };
      }
    }

    // Load profile data
    const profileData = loadProfile(username);
    if (!profileData) {
      throw new Error(`Profile not found for username: ${username}. Run linkedin-extractor first.`);
    }

    const profile = profileData.profile;

    // Load raw data for richer analysis
    const rawProfile = loadRawProfile(username);
    const rawPosts = loadRawPosts(username);

    // Determine mode
    const postCount = profile.posts?.length || 0;
    const useProfileOnly = profileOnlyMode || postCount === 0;

    console.log(`[personality-builder] Mode: ${useProfileOnly ? 'PROFILE-ONLY (zero posts)' : 'FULL (with posts)'}`);
    console.log(`[personality-builder] Posts available: ${postCount}`);

    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    const openai = new OpenAI({ apiKey });

    // Build prompts
    const profileSummary = buildProfileSummary(profile);
    const rawDataSummary = buildRawDataSummary(rawProfile?.data);
    const rawPostsSummary = buildRawPostsSummary(rawPosts?.data);

    const systemPrompt = useProfileOnly ? PROFILE_ONLY_PERSONALITY_PROMPT : PERSONALITY_ANALYSIS_PROMPT;

    const userPrompt = useProfileOnly
      ? `## PROFILE DATA
${profileSummary}

## EXTENDED PROFILE DATA (from raw scrape)
${rawDataSummary}

## FEED CONTEXT
Topics they engage with: ${(profile.feedTopics || []).join(", ") || "Not available"}

NOTE: This user has NO LinkedIn posts. Build personality entirely from their profile, experience, headline, about section, skills, and network context.
Please analyze this profile and return a JSON object matching the schema provided.
Set writingStyle.available = false since there are no posts to analyze.`
      : `## PROFILE DATA
${profileSummary}

## EXTENDED PROFILE DATA (from raw scrape)
${rawDataSummary}

## POSTS - DETAILED (${rawPosts?.data?.length || profile.posts?.length || 0} available)
${rawPostsSummary || formatPosts(profile.posts || [])}

## FEED CONTEXT
Topics they engage with: ${(profile.feedTopics || []).join(", ") || "Not available"}

Please analyze this profile and return a JSON object matching the schema provided.
Remember: If fewer than 3 posts are available, set writingStyle.available = false.`;

    console.log(`[personality-builder] Calling OpenAI GPT-5.2...`);

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    let parsed;

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse OpenAI response as JSON');
      }
    }

    const generatedAt = new Date().toISOString();

    // Save to storage
    const storageData = {
      username,
      generatedAt,
      sources: {
        rawProfile: rawProfile ? `data/raw/${username}_profile.json` : null,
        rawPosts: rawPosts ? `data/raw/${username}_posts.json` : null,
      },
      rawDataUsed: {
        profileAvailable: !!rawProfile,
        postsAvailable: !!rawPosts,
        postsCount: rawPosts?.data?.length || 0,
      },
      analysis: parsed,
    };

    const storagePath = savePersonality(username, storageData);
    console.log(`[personality-builder] Saved to ${storagePath}`);

    return {
      username,
      analysis: parsed,
      storagePath,
      generatedAt,
      fromCache: false,
    };
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildProfileSummary(profile: any): string {
  const lines = [];

  if (profile.name) lines.push(`Name: ${profile.name}`);
  if (profile.headline) lines.push(`Headline: ${profile.headline}`);
  if (profile.location) lines.push(`Location: ${profile.location}`);
  if (profile.currentRole) lines.push(`Current Role: ${profile.currentRole}`);
  if (profile.currentCompany) lines.push(`Current Company: ${profile.currentCompany}`);
  if (profile.industry) lines.push(`Industry: ${profile.industry}`);
  if (profile.about) lines.push(`About:\n${profile.about}`);
  if (profile.followerCount) lines.push(`Followers: ${profile.followerCount}`);
  if (profile.connectionCount) lines.push(`Connections: ${profile.connectionCount}`);

  if (profile.experiences && profile.experiences.length > 0) {
    lines.push(`\nExperiences (${profile.experiences.length}):`);
    profile.experiences.forEach((exp: any, i: number) => {
      lines.push(`  ${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate || "?"} - ${exp.endDate || "Present"})`);
      if (exp.description) lines.push(`     ${exp.description}`);
    });
  }

  if (profile.experience && profile.experience.length > 0) {
    lines.push(`\nExperiences (${profile.experience.length}):`);
    profile.experience.forEach((exp: any, i: number) => {
      lines.push(`  ${i + 1}. ${exp.title} at ${exp.company} (${exp.duration || "N/A"})`);
      if (exp.description) lines.push(`     ${exp.description}`);
    });
  }

  if (profile.educations && profile.educations.length > 0) {
    lines.push(`\nEducation (${profile.educations.length}):`);
    profile.educations.forEach((edu: any, i: number) => {
      lines.push(`  ${i + 1}. ${edu.school} - ${edu.degree || "N/A"}${edu.grade ? ` (${edu.grade})` : ""}`);
    });
  }

  if (profile.education && profile.education.length > 0) {
    lines.push(`\nEducation (${profile.education.length}):`);
    profile.education.forEach((edu: any, i: number) => {
      lines.push(`  ${i + 1}. ${edu.school}: ${edu.degree || ""} ${edu.field || ""}`);
    });
  }

  if (profile.skills && profile.skills.length > 0) {
    lines.push(`\nSkills: ${profile.skills.join(", ")}`);
  }

  return lines.join("\n");
}

function buildRawDataSummary(rawData: any): string {
  if (!rawData) return "No raw data available";

  const lines = [];

  if (rawData.licenseAndCertificates && rawData.licenseAndCertificates.length > 0) {
    lines.push(`Certifications (${rawData.licenseAndCertificates.length}):`);
    rawData.licenseAndCertificates.forEach((cert: any) => {
      lines.push(`  - ${cert.name} (${cert.authority})`);
    });
  }

  if (rawData.recommendationsReceived && rawData.recommendationsReceived.length > 0) {
    lines.push(`\nRecommendations Received (${rawData.recommendationsReceived.length}):`);
    rawData.recommendationsReceived.forEach((rec: any) => {
      lines.push(`  From: ${rec.name} (${rec.subtitle})`);
      lines.push(`  "${rec.description?.slice(0, 300)}${rec.description?.length > 300 ? "..." : ""}"`);
    });
  }

  if (rawData.peopleAlsoViewed && rawData.peopleAlsoViewed.length > 0) {
    lines.push(`\nPeople Also Viewed (top 10):`);
    rawData.peopleAlsoViewed.slice(0, 10).forEach((person: any) => {
      lines.push(`  - ${person.first_name} ${person.last_name}: ${person.headline}`);
    });
  }

  const statusFlags = [];
  if (rawData.isPremium) statusFlags.push("Premium");
  if (rawData.isCreator) statusFlags.push("Creator");
  if (rawData.isInfluencer) statusFlags.push("Influencer");
  if (statusFlags.length > 0) {
    lines.push(`\nStatus: ${statusFlags.join(", ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No extended data available";
}

function formatPosts(posts: Array<{ text: string; likes: number; comments: number; date?: string | null }>): string {
  if (!posts || posts.length === 0) {
    return "No posts available";
  }

  return posts
    .map((post, i) => {
      const engagement = `(${post.likes || 0} likes, ${post.comments || 0} comments)`;
      const date = post.date ? ` - ${post.date}` : "";
      return `Post ${i + 1}${date} ${engagement}:\n${post.text}`;
    })
    .join("\n\n");
}

function buildRawPostsSummary(rawPosts: any[]): string {
  if (!rawPosts || rawPosts.length === 0) {
    return "";
  }

  const lines = [];
  lines.push(`Total posts scraped: ${rawPosts.length}`);

  const totalReactions = rawPosts.reduce((sum: number, p: any) => sum + (p.stats?.total_reactions || 0), 0);
  const avgReactions = Math.round(totalReactions / rawPosts.length);
  lines.push(`Average reactions per post: ${avgReactions}`);

  const sortedByEngagement = [...rawPosts].sort((a: any, b: any) =>
    (b.stats?.total_reactions || 0) - (a.stats?.total_reactions || 0)
  );

  lines.push(`\n--- TOP 15 MOST ENGAGING POSTS ---`);
  sortedByEngagement.slice(0, 15).forEach((post: any, i: number) => {
    const stats = post.stats || {};
    lines.push(`\nTop Post ${i + 1} [${post.posted_at?.date || "Unknown date"}]:`);
    lines.push(`  Reactions: ${stats.total_reactions || 0}, Comments: ${stats.comments || 0}`);
    lines.push(`  Content: "${post.text || ""}"`);
  });

  lines.push(`\n--- ALL ${rawPosts.length} POSTS ---`);
  rawPosts.forEach((post: any, i: number) => {
    lines.push(`\nPost ${i + 1} [${post.posted_at?.date || "Unknown"}] (${post.stats?.total_reactions || 0} reactions):`);
    lines.push(`"${post.text || ""}"`);
  });

  return lines.join("\n");
}

export default personalityBuilderTool;
