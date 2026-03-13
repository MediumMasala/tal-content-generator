import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { executeContentGeneration, ContentGenerationInput } from './mastra';

/**
 * Tal Content Engine - Express Server (Mastra-based)
 *
 * Production-ready API for generating LinkedIn posts
 * Compatible with the React frontend on Vercel
 */

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://tal-content.vercel.app', 'https://tal-content.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8501'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    framework: 'mastra',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// MAIN GENERATION ENDPOINT
// ============================================

app.post('/api/generate', async (req, res) => {
  const {
    linkedinUrl,
    username,
    userTopic,
    customContext,
    forceRefresh,
    regenerate,
    skipOptimization,
  } = req.body;

  // Validate input
  if (!linkedinUrl && !username) {
    return res.status(400).json({
      error: 'linkedinUrl or username is required',
    });
  }

  const isRegeneration = regenerate && username;
  console.log(`[API] Starting ${isRegeneration ? 'regeneration' : 'generation'} for: ${linkedinUrl || username}`);
  console.log(`[API] User topic: ${userTopic || '(none)'}`);

  // Build input
  const input: ContentGenerationInput = {
    linkedinUrl: linkedinUrl || `https://linkedin.com/in/${username}`,
    userTopic,
    customContext,
    forceRefresh: forceRefresh || false,
    regenerate: isRegeneration || false,
    skipOptimization: skipOptimization || false,
  };

  try {
    const result = await executeContentGeneration(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Generation failed',
      });
    }

    // Load personality data for frontend display
    const { loadPersonality, loadProfile } = require('./mastra/storage/local-storage');
    const personalityData = loadPersonality(result.username);
    const profileData = loadProfile(result.username);

    const analysis = personalityData?.analysis || {};
    const profile = profileData?.profile || {};
    const postCount = profile.posts?.length || 0;
    const isProfileOnlyMode = postCount === 0;

    // Calculate average word count from posts
    let averageWordCount: number | null = null;
    if (profile.posts && profile.posts.length > 0) {
      const wordCounts = profile.posts
        .map((p: any) => (p.text || '').split(/\s+/).filter((w: string) => w.length > 0).length)
        .filter((c: number) => c > 10);
      if (wordCounts.length > 0) {
        averageWordCount = Math.round(wordCounts.reduce((a: number, b: number) => a + b, 0) / wordCounts.length);
      }
    }

    // Build personality object for frontend
    const personality = {
      traits: analysis.personalityGraph?.coreIdentity?.evidence || [],
      values: analysis.personalityGraph?.worldviewAndInfluences?.evidence || [],
      communicationStyle: analysis.personalityGraph?.communicationStyle || null,
      professionalIdentity: analysis.personalityGraph?.coreIdentity?.inference || null,
    };

    // Build knowledge graph for frontend
    const knowledgeGraph = {
      industries: analysis.knowledgeGraph?.industries || [],
      technologies: analysis.knowledgeGraph?.technologies || [],
      topics: analysis.knowledgeGraph?.topics || [],
    };

    // Build writing style for frontend
    const writingStyle = analysis.writingGraph ? {
      voiceSummary: analysis.writingGraph.dominantTone || null,
      toneAttributes: [
        analysis.writingGraph.publicThinkingStyle,
        analysis.writingGraph.directnessVsSoftness,
        analysis.writingGraph.emotionalOpennessVsRestraint,
      ].filter(Boolean),
      formattingPatterns: {
        shortLines: analysis.writingGraph.lineBreakStyle?.includes('short'),
        spacedParagraphs: analysis.writingGraph.paragraphRhythm?.includes('spaced'),
        emojiUsage: analysis.writingGraph.emojiHashtagBehavior || 'none',
        otherHabits: analysis.writingGraph.recurringWritingMoves || [],
      },
    } : null;

    // Format response for frontend compatibility
    const response = {
      success: true,
      profileOnlyMode: isProfileOnlyMode,
      personName: result.personName,
      currentRole: result.currentRole,
      currentCompany: result.currentCompany,
      username: result.username,
      writingStyleAvailable: !!analysis.writingGraph,
      postCount: postCount,
      originalPostCount: postCount,
      averageWordCount: averageWordCount,

      // Personality data for frontend display
      personality,
      knowledgeGraph,
      writingStyle,

      // Original generated post (WITHOUT optimization)
      originalPost: {
        content: result.rawPost,
        altContent: result.rawAltVersion,
      },

      // Recommended posts (WITH optimization)
      recommendedPosts: [
        {
          type: 'Optimized',
          description: 'Best version with improved hook and structure',
          content: result.mainPost,
        },
        {
          type: 'Alternative Hook',
          description: 'Same content, different opening',
          content: result.altHook,
        },
        {
          type: 'Alternative Structure',
          description: 'Different structure/format',
          content: result.altStructure,
        },
        {
          type: 'Short Version',
          description: 'Condensed, punchier version',
          content: result.altShort,
        },
      ].filter(p => p.content), // Only include non-empty posts

      // Image suggestions
      imageSuggestions: [
        {
          title: 'Minimal Portrait',
          rationale: 'Clean headshot reinforces personal credibility',
          type: 'portrait',
          isRecommended: true,
        },
        {
          title: 'Product Screenshot',
          rationale: 'Show the interface for visual context',
          type: 'screenshot',
          isRecommended: false,
        },
        {
          title: 'No Image',
          rationale: 'Text-only posts often perform well for insight content',
          type: 'none',
          isRecommended: false,
        },
      ],

      // Timing info
      timing: result.timing,

      // Additional notes
      personalityNotes: result.optimizationNotes,
      topicUsed: result.topicUsed,
      topicConfidence: result.topicConfidence,
    };

    console.log(`[API] Generation complete for ${result.username}`);
    res.json(response);

  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An error occurred',
    });
  }
});

// ============================================
// REGENERATE ENDPOINT (shortcut)
// ============================================

app.post('/api/regenerate', async (req, res) => {
  const { username, userTopic, customContext } = req.body;

  if (!username) {
    return res.status(400).json({
      error: 'username is required',
    });
  }

  const input: ContentGenerationInput = {
    linkedinUrl: `https://linkedin.com/in/${username}`,
    userTopic,
    customContext,
    forceRefresh: false,
    regenerate: true,
    skipOptimization: false,
  };

  console.log(`[API] Regenerating for: ${username}`);

  try {
    const result = await executeContentGeneration(input);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Regeneration failed',
      });
    }

    res.json({
      success: true,
      username: result.username,
      topicUsed: result.topicUsed,
      mainPost: result.mainPost,
      altHook: result.altHook,
      altStructure: result.altStructure,
      altShort: result.altShort,
      timing: result.timing,
    });

  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'An error occurred',
    });
  }
});

// ============================================
// LIST CACHED PROFILES
// ============================================

app.get('/api/profiles', (req, res) => {
  try {
    const { listProfiles, listPersonalities } = require('./mastra/storage/local-storage');

    const profiles = listProfiles();
    const personalities = listPersonalities();

    res.json({
      profiles,
      personalities,
      count: {
        profiles: profiles.length,
        personalities: personalities.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to list profiles',
    });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Tal Content Engine v2.0 (Mastra)                 ║
║                                                        ║
║   Server running on http://localhost:${PORT}             ║
║                                                        ║
║   Endpoints:                                           ║
║     POST /api/generate    - Generate content           ║
║     POST /api/regenerate  - Regenerate with new angle  ║
║     GET  /api/profiles    - List cached profiles       ║
║     GET  /api/health      - Health check               ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
});

export default app;
