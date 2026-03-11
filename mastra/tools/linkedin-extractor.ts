import { z } from "zod";
import { ApifyClient } from "apify-client";
import {
  extractUsername,
  saveProfile,
  loadProfile,
  profileExists,
  getProfilePath,
  saveRawProfile,
  saveRawPosts,
  getRawProfilePath,
  getRawPostsPath,
} from "../storage/local-storage";

// Output schema for posts
const PostSchema = z.object({
  text: z.string(),
  likes: z.number(),
  comments: z.number(),
  reposts: z.number().optional(),
  date: z.string().nullable(),
  postType: z.string().optional(),
  url: z.string().nullable().optional(),
});

// Output schema for experience
const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  isCurrent: z.boolean(),
});

// Output schema for education
const EducationSchema = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  grade: z.string().nullable(),
});

// Main profile schema
const ProfileSchema = z.object({
  name: z.string().nullable(),
  headline: z.string().nullable(),
  location: z.string().nullable(),
  profilePicture: z.string().nullable(),
  currentRole: z.string().nullable(),
  currentCompany: z.string().nullable(),
  industry: z.string().nullable(),
  about: z.string().nullable(),
  email: z.string().nullable(),
  posts: z.array(PostSchema),
  experiences: z.array(ExperienceSchema),
  educations: z.array(EducationSchema),
  skills: z.array(z.string()),
  followerCount: z.number().nullable(),
  connectionCount: z.number().nullable(),
  totalExperienceYears: z.number().nullable(),
  isCreator: z.boolean().nullable(),
  isVerified: z.boolean().nullable(),
});

// Tool output schema
export const LinkedInExtractorOutputSchema = z.object({
  username: z.string(),
  profile: ProfileSchema,
  storagePath: z.string(),
  scrapedAt: z.string(),
});

export type LinkedInExtractorOutput = z.infer<typeof LinkedInExtractorOutputSchema>;

// Tool input schema
export const LinkedInExtractorInputSchema = z.object({
  linkedinUrl: z.string().url(),
  forceRefresh: z.boolean().optional().default(false),
});

export type LinkedInExtractorInput = z.infer<typeof LinkedInExtractorInputSchema>;

/**
 * Parse profile data from dev_fusion/linkedin-profile-scraper
 */
function parseProfileData(profileData: any): Partial<z.infer<typeof ProfileSchema>> {
  if (!profileData) return {};

  // Parse experiences
  const experiences = (profileData.experiences || []).map((exp: any) => ({
    title: exp.title || "",
    company: exp.companyName || "",
    description: exp.jobDescription || null,
    startDate: exp.jobStartedOn || null,
    endDate: exp.jobEndedOn || null,
    isCurrent: exp.jobStillWorking || false,
  }));

  // Parse educations
  const educations = (profileData.educations || []).map((edu: any) => ({
    school: edu.title || "",
    degree: edu.subtitle || null,
    grade: edu.grade || null,
  }));

  // Parse skills
  const skills = (profileData.skills || []).map((skill: any) => skill.title || skill).filter(Boolean);

  return {
    name: profileData.fullName || null,
    headline: profileData.headline || null,
    location: profileData.addressWithCountry || profileData.jobLocation || null,
    profilePicture: profileData.profilePic || profileData.profilePicHighQuality || null,
    currentRole: profileData.jobTitle || null,
    currentCompany: profileData.companyName || null,
    industry: profileData.companyIndustry || null,
    about: profileData.about || null,
    email: profileData.email || null,
    experiences,
    educations,
    skills,
    followerCount: profileData.followers || null,
    connectionCount: profileData.connections || null,
    totalExperienceYears: profileData.totalExperienceYears || null,
    isCreator: profileData.isCreator || null,
    isVerified: profileData.isVerified || null,
  };
}

/**
 * Parse posts data from apimaestro/linkedin-profile-posts
 */
function parsePostsData(postsData: any[], targetUsername: string): z.infer<typeof PostSchema>[] {
  if (!postsData || postsData.length === 0) return [];

  return postsData
    .filter((post: any) => {
      // Only include posts authored by the target user
      const postAuthor = post.author?.username?.toLowerCase();
      return postAuthor === targetUsername.toLowerCase();
    })
    .map((post: any) => ({
      text: post.text || "",
      likes: post.stats?.total_reactions || post.stats?.like || 0,
      comments: post.stats?.comments || 0,
      reposts: post.stats?.reposts || 0,
      date: post.posted_at?.date || post.posted_at?.relative || null,
      postType: post.post_type || "regular",
      url: post.url || null,
    }));
}

/**
 * Combine profile and posts data into final format
 */
function combineProfileAndPosts(
  profileData: Partial<z.infer<typeof ProfileSchema>>,
  posts: z.infer<typeof PostSchema>[]
): z.infer<typeof ProfileSchema> {
  return {
    name: profileData.name || null,
    headline: profileData.headline || null,
    location: profileData.location || null,
    profilePicture: profileData.profilePicture || null,
    currentRole: profileData.currentRole || null,
    currentCompany: profileData.currentCompany || null,
    industry: profileData.industry || null,
    about: profileData.about || null,
    email: profileData.email || null,
    posts,
    experiences: profileData.experiences || [],
    educations: profileData.educations || [],
    skills: profileData.skills || [],
    followerCount: profileData.followerCount || null,
    connectionCount: profileData.connectionCount || null,
    totalExperienceYears: profileData.totalExperienceYears || null,
    isCreator: profileData.isCreator || null,
    isVerified: profileData.isVerified || null,
  };
}


/**
 * LinkedIn Extractor Tool
 *
 * Scrapes LinkedIn profile using Apify, parses the data,
 * and stores it in local JSON storage.
 */
export async function extractLinkedIn(
  input: LinkedInExtractorInput
): Promise<LinkedInExtractorOutput> {
  const username = extractUsername(input.linkedinUrl);

  // Check cache unless force refresh
  if (!input.forceRefresh && profileExists(username)) {
    console.log(`[linkedin-extractor] Loading cached profile for ${username}`);
    const cached = loadProfile(username);
    if (cached) {
      return {
        username,
        profile: cached.profile,
        storagePath: getProfilePath(username),
        scrapedAt: cached.scrapedAt,
      };
    }
  }

  console.log(`[linkedin-extractor] Scraping LinkedIn profile: ${input.linkedinUrl}`);

  // Initialize Apify client
  const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
  if (!apifyToken) {
    throw new Error("APIFY_API_TOKEN environment variable is required");
  }

  const client = new ApifyClient({ token: apifyToken });

  // Actor IDs
  const profileActorId = process.env.APIFY_PROFILE_ACTOR || "dev_fusion/linkedin-profile-scraper";
  const postsActorId = process.env.APIFY_POSTS_ACTOR || "apimaestro/linkedin-profile-posts";

  try {
    // Step 1: Scrape profile data
    console.log(`[linkedin-extractor] Scraping profile with ${profileActorId}...`);
    const profileRun = await client.actor(profileActorId).call({
      profileUrls: [input.linkedinUrl],
    });
    const { items: profileItems } = await client.dataset(profileRun.defaultDatasetId).listItems();

    if (!profileItems || profileItems.length === 0) {
      throw new Error("No profile data returned from LinkedIn scraper");
    }

    // Save raw profile data
    const rawProfileData = profileItems[0];
    const rawProfilePath = saveRawProfile(username, {
      scrapedAt: new Date().toISOString(),
      source: profileActorId,
      data: rawProfileData,
    });
    console.log(`[linkedin-extractor] Raw profile saved to ${rawProfilePath}`);

    const profileData = parseProfileData(rawProfileData);
    console.log(`[linkedin-extractor] Got profile data for ${profileData.name}`);

    // Step 2: Scrape posts (up to 75, returns whatever is available)
    console.log(`[linkedin-extractor] Scraping posts with ${postsActorId}...`);
    const postsRun = await client.actor(postsActorId).call({
      username: username,
      limit: 75,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    });
    const { items: postItems } = await client.dataset(postsRun.defaultDatasetId).listItems();

    // Save raw posts data
    const rawPostsPath = saveRawPosts(username, {
      scrapedAt: new Date().toISOString(),
      source: postsActorId,
      data: postItems || [],
    });
    console.log(`[linkedin-extractor] Raw posts saved to ${rawPostsPath}`);

    const posts = parsePostsData(postItems || [], username);
    console.log(`[linkedin-extractor] Got ${posts.length} posts`);

    // Combine data
    const profile = combineProfileAndPosts(profileData, posts);
    const scrapedAt = new Date().toISOString();

    // Save to storage
    const storageData = {
      username,
      scrapedAt,
      sources: {
        profile: profileActorId,
        posts: postsActorId,
      },
      rawDataPaths: {
        profile: getRawProfilePath(username),
        posts: getRawPostsPath(username),
      },
      profile,
    };

    const storagePath = saveProfile(username, storageData);

    console.log(`[linkedin-extractor] Profile saved to ${storagePath}`);

    return {
      username,
      profile,
      storagePath,
      scrapedAt,
    };
  } catch (error) {
    console.error(`[linkedin-extractor] Error scraping LinkedIn:`, error);
    throw new Error(`Failed to scrape LinkedIn profile: ${error}`);
  }
}

/**
 * Tool definition for Mastra
 */
export const linkedinExtractorTool = {
  id: "linkedin-extractor",
  name: "LinkedIn Extractor",
  description: "Extract and store LinkedIn profile data using Apify",
  inputSchema: LinkedInExtractorInputSchema,
  outputSchema: LinkedInExtractorOutputSchema,
  execute: extractLinkedIn,
};

export default linkedinExtractorTool;
