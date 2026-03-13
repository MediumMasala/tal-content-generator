import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { ApifyClient } from 'apify-client';
import { saveProfile, loadProfile, extractUsername } from '../storage/local-storage';

/**
 * LinkedIn Extractor Tool
 *
 * Scrapes LinkedIn profile data using Apify API and stores locally.
 */
export const linkedinExtractorTool = createTool({
  id: 'linkedin-extractor',
  description: 'Extract LinkedIn profile data including posts, about section, experience, and more',

  inputSchema: z.object({
    linkedinUrl: z.string().url().describe('The LinkedIn profile URL to scrape'),
    forceRefresh: z.boolean().optional().default(false).describe('Force re-scraping even if cached'),
  }),

  outputSchema: z.object({
    username: z.string(),
    profile: z.object({
      name: z.string().nullable(),
      headline: z.string().nullable(),
      location: z.string().nullable(),
      about: z.string().nullable(),
      currentRole: z.string().nullable(),
      currentCompany: z.string().nullable(),
      profilePicture: z.string().nullable(),
      followerCount: z.number().nullable(),
      connectionCount: z.number().nullable(),
      posts: z.array(z.object({
        text: z.string(),
        likes: z.number().optional(),
        comments: z.number().optional(),
        reposts: z.number().optional(),
        isRepost: z.boolean().optional(),
        postedDate: z.string().nullable(),
      })),
      experience: z.array(z.object({
        title: z.string(),
        company: z.string(),
        duration: z.string().nullable(),
        description: z.string().nullable(),
      })),
      education: z.array(z.object({
        school: z.string(),
        degree: z.string().nullable(),
        field: z.string().nullable(),
      })),
    }),
    originalPostCount: z.number(),
    averageWordCount: z.number().nullable(),
    storagePath: z.string(),
    scrapedAt: z.string(),
    fromCache: z.boolean(),
  }),

  execute: async ({ linkedinUrl, forceRefresh }) => {
    const username = extractUsername(linkedinUrl);
    console.log(`[linkedin-extractor] Extracting profile for: ${username}`);

    // Check cache first
    if (!forceRefresh) {
      const cached = loadProfile(username);
      if (cached) {
        console.log(`[linkedin-extractor] Found cached profile for ${username}`);
        return {
          ...cached,
          fromCache: true,
        };
      }
    }

    // Initialize Apify client
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      throw new Error('APIFY_API_TOKEN environment variable is required');
    }

    const client = new ApifyClient({ token: apifyToken });

    console.log(`[linkedin-extractor] Calling Apify API...`);

    // Run the LinkedIn scraper
    const run = await client.actor('apimaestro/linkedin-profile-posts').call({
      profileUrls: [linkedinUrl],
      maxPosts: 50,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ['RESIDENTIAL'],
      },
    });

    // Fetch results
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      throw new Error(`No data returned for ${linkedinUrl}`);
    }

    const rawProfile = items[0] as any;

    // Parse posts
    const posts = (rawProfile.posts || []).map((post: any) => ({
      text: post.text || post.postText || '',
      likes: post.numLikes || post.likeCount || 0,
      comments: post.numComments || post.commentCount || 0,
      reposts: post.numReposts || post.repostCount || 0,
      isRepost: post.isRepost || false,
      postedDate: post.postedDate || post.date || null,
    }));

    // Calculate original post stats
    const originalPosts = posts.filter((p: any) => !p.isRepost);
    const originalPostCount = originalPosts.length;

    let averageWordCount: number | null = null;
    if (originalPostCount > 0) {
      const totalWords = originalPosts.reduce((sum: number, p: any) => {
        return sum + (p.text || '').split(/\s+/).filter((w: string) => w.length > 0).length;
      }, 0);
      averageWordCount = Math.round(totalWords / originalPostCount);
    }

    // Parse experience
    const experience = (rawProfile.experience || []).map((exp: any) => ({
      title: exp.title || exp.position || '',
      company: exp.company || exp.companyName || '',
      duration: exp.duration || exp.dateRange || null,
      description: exp.description || null,
    }));

    // Parse education
    const education = (rawProfile.education || []).map((edu: any) => ({
      school: edu.school || edu.schoolName || '',
      degree: edu.degree || null,
      field: edu.field || edu.fieldOfStudy || null,
    }));

    // Build profile object
    const profile = {
      name: rawProfile.name || rawProfile.fullName || null,
      headline: rawProfile.headline || rawProfile.tagline || null,
      location: rawProfile.location || null,
      about: rawProfile.about || rawProfile.summary || null,
      currentRole: rawProfile.currentRole || experience[0]?.title || null,
      currentCompany: rawProfile.currentCompany || experience[0]?.company || null,
      profilePicture: rawProfile.profilePicture || rawProfile.profileImageUrl || null,
      followerCount: rawProfile.followerCount || rawProfile.followersCount || null,
      connectionCount: rawProfile.connectionCount || rawProfile.connectionsCount || null,
      posts,
      experience,
      education,
    };

    const scrapedAt = new Date().toISOString();

    // Save to storage
    const result = {
      username,
      profile,
      originalPostCount,
      averageWordCount,
      scrapedAt,
      storagePath: '',
      fromCache: false,
    };

    const storagePath = saveProfile(username, result);
    result.storagePath = storagePath;

    console.log(`[linkedin-extractor] Saved profile to ${storagePath}`);
    console.log(`[linkedin-extractor] Found ${posts.length} posts (${originalPostCount} original)`);

    return result;
  },
});

export default linkedinExtractorTool;
