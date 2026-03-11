import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { executeContentGeneration } from './mastra/workflows/content-generation';
import { generateLinkedInFriendly } from './mastra/tools/linkedin-friendly';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL || 'https://tal-content.vercel.app', 'https://tal-content.vercel.app']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main generation endpoint
app.post('/api/generate', async (req, res) => {
  const { linkedinUrl } = req.body;

  if (!linkedinUrl) {
    return res.status(400).json({ error: 'linkedinUrl is required' });
  }

  console.log(`[API] Starting generation for: ${linkedinUrl}`);

  try {
    // Step 1-3: Extract, Build Personality, Generate
    const result = await executeContentGeneration({
      linkedinUrl,
      forceRefresh: false,
    });

    if (!result.success) {
      return res.status(500).json({
        error: (result as any).error,
        step: (result as any).step,
      });
    }

    // Track if this is a profile-only analysis (zero posts)
    const isProfileOnlyMode = result.postCount === 0;
    if (isProfileOnlyMode) {
      console.log(`[API] User ${result.username} has zero posts - using profile-only analysis`);
    }

    // Step 4: LinkedIn Friendly optimization
    console.log(`[API] Running viral optimization...`);
    const friendlyResult = await generateLinkedInFriendly({
      username: result.username,
      generatedPost: result.content,
      altVersion: result.altVersion,
      viralPostsCsvPath: './data/viral-posts.csv',
    });

    // Build response
    const response = {
      success: true,
      profileOnlyMode: isProfileOnlyMode, // true if user had zero posts
      personName: result.personName,
      currentRole: result.currentRole,
      currentCompany: result.currentCompany,
      username: result.username,
      writingStyleAvailable: result.writingStyleAvailable,
      postCount: result.postCount,
      personality: result.personality,
      knowledgeGraph: result.knowledgeGraph,
      writingStyle: result.writingStyle,
      // Original generated post (WITHOUT viral CSV optimization)
      originalPost: {
        content: result.content,
        altContent: result.altVersion,
      },
      // Recommended posts (WITH viral CSV optimization)
      recommendedPosts: [
        {
          type: friendlyResult.structureUsed?.split(',')[0]?.trim() || 'Optimized',
          description: 'Refined using top-performing LinkedIn post patterns',
          content: friendlyResult.optimizedPost,
        },
        {
          type: friendlyResult.structureUsed?.split(',')[1]?.trim() || 'Alternative Hook',
          description: 'Alternative angle optimized for engagement',
          content: friendlyResult.altOptimizedPost,
        },
      ],
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
      timing: result.timing,
      personalityNotes: friendlyResult.personalityNotes,
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

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
