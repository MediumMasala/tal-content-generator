import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  loadProfile,
  loadPersonality,
  savePersonality,
  personalityExists,
  getPersonalityPath,
  loadRawProfile,
  loadRawPosts,
} from "../storage/local-storage";
import { PERSONALITY_ANALYSIS_PROMPT, PROFILE_ONLY_PERSONALITY_PROMPT } from "../context/tal-context";

// The new comprehensive personality analysis output schema
// This is a flexible schema that accepts the rich output from the new prompt

// Tool output schema - flexible to accept the comprehensive analysis
export const PersonalityBuilderOutputSchema = z.object({
  username: z.string(),
  analysis: z.any(), // The full comprehensive analysis from Gemini
  storagePath: z.string(),
  generatedAt: z.string(),
});

export type PersonalityBuilderOutput = z.infer<typeof PersonalityBuilderOutputSchema>;

// Tool input schema
export const PersonalityBuilderInputSchema = z.object({
  username: z.string(),
  forceRefresh: z.boolean().optional().default(false),
  profileOnlyMode: z.boolean().optional().default(false), // For users with zero posts
});

export type PersonalityBuilderInput = z.infer<typeof PersonalityBuilderInputSchema>;

/**
 * Personality Builder Tool
 *
 * Analyzes LinkedIn profile and creates a comprehensive personality profile,
 * knowledge graph, and writing style analysis.
 */
export async function buildPersonality(
  input: PersonalityBuilderInput
): Promise<PersonalityBuilderOutput> {
  const { username, forceRefresh, profileOnlyMode } = input;

  // Check cache unless force refresh
  if (!forceRefresh && personalityExists(username)) {
    console.log(`[personality-builder] Loading cached personality for ${username}`);
    const cached = loadPersonality(username);
    if (cached) {
      return {
        username,
        analysis: cached.analysis || cached, // Support both new and old format
        storagePath: getPersonalityPath(username),
        generatedAt: cached.generatedAt,
      };
    }
  }

  // Load profile from storage
  const profileData = loadProfile(username);
  if (!profileData) {
    throw new Error(`Profile not found for username: ${username}. Run linkedin-extractor first.`);
  }

  const profile = profileData.profile;

  // Load raw data for richer analysis
  const rawProfile = loadRawProfile(username);
  const rawPosts = loadRawPosts(username);

  console.log(`[personality-builder] Analyzing personality for ${username}`);
  console.log(`[personality-builder] Mode: ${profileOnlyMode ? 'PROFILE-ONLY (zero posts)' : 'FULL (with posts)'}`);
  console.log(`[personality-builder] Raw data available: profile=${!!rawProfile}, posts=${!!rawPosts}`);

  // Initialize Gemini client
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-pro",
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  // Build the prompt with profile data
  const profileSummary = buildProfileSummary(profile);
  const rawDataSummary = buildRawDataSummary(rawProfile?.data);
  const rawPostsSummary = buildRawPostsSummary(rawPosts?.data);

  // Select prompt based on mode
  const systemPrompt = profileOnlyMode
    ? PROFILE_ONLY_PERSONALITY_PROMPT
    : PERSONALITY_ANALYSIS_PROMPT;

  // Build user prompt based on mode
  const userPrompt = profileOnlyMode
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

  try {
    // Combine system prompt and user prompt for Gemini
    const fullPrompt = `${systemPrompt}\n\n---\n\nNow analyze this profile:\n\n${userPrompt}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const responseText = response.text() || "{}";
    let parsed;

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse Gemini response as JSON");
      }
    }

    const generatedAt = new Date().toISOString();

    // Save to storage
    const storageData = {
      username,
      generatedAt,
      sources: {
        parsedProfile: getPersonalityPath(username).replace("personalities", "profiles"),
        rawProfile: rawProfile ? `data/raw/${username}_profile.json` : null,
        rawPosts: rawPosts ? `data/raw/${username}_posts.json` : null,
      },
      rawDataUsed: {
        profileAvailable: !!rawProfile,
        postsAvailable: !!rawPosts,
        postsCount: rawPosts?.data?.length || 0,
      },
      analysis: parsed, // The full comprehensive analysis
    };

    const storagePath = savePersonality(username, storageData);

    console.log(`[personality-builder] Comprehensive personality analysis saved to ${storagePath}`);

    return {
      username,
      analysis: parsed,
      storagePath,
      generatedAt,
    };
  } catch (error) {
    console.error(`[personality-builder] Error analyzing personality:`, error);
    throw new Error(`Failed to analyze personality: ${error}`);
  }
}

/**
 * Build a text summary of the profile for the LLM
 */
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

  // Add experiences
  if (profile.experiences && profile.experiences.length > 0) {
    lines.push(`\nExperiences (${profile.experiences.length}):`);
    profile.experiences.forEach((exp: any, i: number) => {
      lines.push(`  ${i + 1}. ${exp.title} at ${exp.company} (${exp.startDate || "?"} - ${exp.endDate || "Present"})`);
      if (exp.description) lines.push(`     ${exp.description}`);
    });
  }

  // Add education
  if (profile.educations && profile.educations.length > 0) {
    lines.push(`\nEducation (${profile.educations.length}):`);
    profile.educations.forEach((edu: any, i: number) => {
      lines.push(`  ${i + 1}. ${edu.school} - ${edu.degree || "N/A"}${edu.grade ? ` (${edu.grade})` : ""}`);
    });
  }

  // Add skills
  if (profile.skills && profile.skills.length > 0) {
    lines.push(`\nSkills: ${profile.skills.join(", ")}`);
  }

  return lines.join("\n");
}

/**
 * Build extended summary from raw Apify data
 */
function buildRawDataSummary(rawData: any): string {
  if (!rawData) return "No raw data available";

  const lines = [];

  // Certifications
  if (rawData.licenseAndCertificates && rawData.licenseAndCertificates.length > 0) {
    lines.push(`Certifications (${rawData.licenseAndCertificates.length}):`);
    rawData.licenseAndCertificates.forEach((cert: any) => {
      lines.push(`  - ${cert.name} (${cert.authority})`);
    });
  }

  // Recommendations received
  if (rawData.recommendationsReceived && rawData.recommendationsReceived.length > 0) {
    lines.push(`\nRecommendations Received (${rawData.recommendationsReceived.length}):`);
    rawData.recommendationsReceived.forEach((rec: any) => {
      lines.push(`  From: ${rec.name} (${rec.subtitle})`);
      lines.push(`  Context: ${rec.context}`);
      lines.push(`  "${rec.description?.slice(0, 300)}${rec.description?.length > 300 ? "..." : ""}"`);
    });
  }

  // People also viewed (network context)
  if (rawData.peopleAlsoViewed && rawData.peopleAlsoViewed.length > 0) {
    lines.push(`\nPeople Also Viewed (top 10 - indicates professional circle):`);
    rawData.peopleAlsoViewed.slice(0, 10).forEach((person: any) => {
      lines.push(`  - ${person.first_name} ${person.last_name}: ${person.headline}`);
    });
  }

  // Premium/Creator/Influencer status
  const statusFlags = [];
  if (rawData.isPremium) statusFlags.push("Premium");
  if (rawData.isCreator) statusFlags.push("Creator");
  if (rawData.isInfluencer) statusFlags.push("Influencer");
  if (rawData.isVerified) statusFlags.push("Verified");
  if (rawData.isJobSeeker) statusFlags.push("Job Seeker");
  if (statusFlags.length > 0) {
    lines.push(`\nStatus: ${statusFlags.join(", ")}`);
  }

  // Total experience
  if (rawData.totalExperienceYears) {
    lines.push(`Total Experience: ${rawData.totalExperienceYears} years`);
  }

  // Company details from current role
  if (rawData.companySize) lines.push(`Current Company Size: ${rawData.companySize}`);
  if (rawData.companyWebsite) lines.push(`Current Company Website: ${rawData.companyWebsite}`);

  return lines.length > 0 ? lines.join("\n") : "No extended data available";
}

/**
 * Format posts for the LLM prompt (fallback)
 */
function formatPosts(posts: Array<{ text: string; likes: number; comments: number; date: string | null }>): string {
  if (!posts || posts.length === 0) {
    return "No posts available";
  }

  // Use ALL posts for comprehensive writing style analysis
  return posts
    .map((post, i) => {
      const engagement = `(${post.likes} likes, ${post.comments} comments)`;
      const date = post.date ? ` - ${post.date}` : "";
      return `Post ${i + 1}${date} ${engagement}:\n${post.text}`;
    })
    .join("\n\n");
}

/**
 * Build detailed summary from raw Apify posts data
 */
function buildRawPostsSummary(rawPosts: any[]): string {
  if (!rawPosts || rawPosts.length === 0) {
    return "";
  }

  const lines = [];
  lines.push(`Total posts scraped: ${rawPosts.length}`);

  // Analyze post types
  const postTypes: Record<string, number> = {};
  rawPosts.forEach((post: any) => {
    const type = post.post_type || "regular";
    postTypes[type] = (postTypes[type] || 0) + 1;
  });
  lines.push(`Post types: ${Object.entries(postTypes).map(([k, v]) => `${k}: ${v}`).join(", ")}`);

  // Calculate engagement stats
  const totalReactions = rawPosts.reduce((sum: number, p: any) => sum + (p.stats?.total_reactions || 0), 0);
  const totalComments = rawPosts.reduce((sum: number, p: any) => sum + (p.stats?.comments || 0), 0);
  const avgReactions = Math.round(totalReactions / rawPosts.length);
  const avgComments = Math.round(totalComments / rawPosts.length);
  lines.push(`\nEngagement Overview:`);
  lines.push(`  Average reactions per post: ${avgReactions}`);
  lines.push(`  Average comments per post: ${avgComments}`);
  lines.push(`  Total reactions across all posts: ${totalReactions}`);

  // Top performing posts
  const sortedByEngagement = [...rawPosts].sort((a: any, b: any) =>
    (b.stats?.total_reactions || 0) - (a.stats?.total_reactions || 0)
  );

  lines.push(`\n--- TOP 15 MOST ENGAGING POSTS ---`);
  sortedByEngagement.slice(0, 15).forEach((post: any, i: number) => {
    const stats = post.stats || {};
    const reactionBreakdown = [];
    if (stats.like) reactionBreakdown.push(`${stats.like} likes`);
    if (stats.support) reactionBreakdown.push(`${stats.support} support`);
    if (stats.love) reactionBreakdown.push(`${stats.love} love`);
    if (stats.insight) reactionBreakdown.push(`${stats.insight} insightful`);
    if (stats.celebrate) reactionBreakdown.push(`${stats.celebrate} celebrate`);
    if (stats.funny) reactionBreakdown.push(`${stats.funny} funny`);

    lines.push(`\nTop Post ${i + 1} [${post.posted_at?.date || "Unknown date"}]:`);
    lines.push(`  Type: ${post.post_type || "regular"}`);
    lines.push(`  Reactions: ${stats.total_reactions || 0} (${reactionBreakdown.join(", ")})`);
    lines.push(`  Comments: ${stats.comments || 0}, Reposts: ${stats.reposts || 0}`);
    lines.push(`  Content: "${post.text || ""}"`);
  });

  // ALL posts for writing style analysis - use complete text
  lines.push(`\n--- ALL ${rawPosts.length} POSTS (for comprehensive writing style analysis) ---`);
  rawPosts.forEach((post: any, i: number) => {
    lines.push(`\nPost ${i + 1} [${post.posted_at?.date || "Unknown"}] (${post.stats?.total_reactions || 0} reactions):`);
    lines.push(`"${post.text || ""}"`);
  });

  return lines.join("\n");
}

/**
 * Tool definition for Mastra
 */
export const personalityBuilderTool = {
  id: "personality-builder",
  name: "Personality Builder",
  description: "Build personality profile from LinkedIn data using AI analysis",
  inputSchema: PersonalityBuilderInputSchema,
  outputSchema: PersonalityBuilderOutputSchema,
  execute: buildPersonality,
};

export default personalityBuilderTool;
