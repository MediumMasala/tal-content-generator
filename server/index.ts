/**
 * Express Server for Tal Content Engine
 *
 * Exposes endpoints for:
 * - /run - Original TAL image generation workflow
 * - /generate-content - New LinkedIn content generation workflow
 */

// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { executeFlow, flowMetadata } from "../mastra/flow";
import { isGeminiAvailable } from "../mastra/gemini/client";
import { generateCaption } from "../mastra/tools/caption_generator";
import { executeContentGeneration, contentGenerationWorkflow } from "../mastra/workflows/content-generation";
import { loadProfile, loadPersonality, listProfiles, listPersonalities, listGenerated } from "../mastra/storage/local-storage";
import { recommendImage } from "../mastra/tools/image-recommender";
import { generateLinkedInFriendly } from "../mastra/tools/linkedin-friendly";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    flow: flowMetadata.name,
    gemini_available: isGeminiAvailable(),
    timestamp: new Date().toISOString(),
  });
});

// Main run endpoint
app.post("/run", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("[Server] POST /run received");
    console.log("[Server] Body:", JSON.stringify(req.body, null, 2));

    // Execute the flow
    const result = await executeFlow(req.body);

    const duration = Date.now() - startTime;
    console.log(`[Server] Flow completed in ${duration}ms`);
    console.log("=".repeat(60) + "\n");

    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] Error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      status: "error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Flow info endpoint
app.get("/flow", (_req: Request, res: Response) => {
  res.json({
    ...flowMetadata,
    gemini_available: isGeminiAvailable(),
  });
});

// Caption generator endpoint
app.post("/caption", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("[Server] POST /caption received");
    console.log("[Server] Body:", JSON.stringify(req.body, null, 2));

    const { image_context, mood, topic } = req.body;

    if (!image_context) {
      res.status(400).json({
        status: "error",
        error: "image_context is required",
      });
      return;
    }

    const result = await generateCaption({
      image_context,
      mood,
      topic,
    });

    const duration = Date.now() - startTime;
    console.log(`[Server] Caption generated in ${duration}ms`);
    console.log("=".repeat(60) + "\n");

    res.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] Caption error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      status: "error",
      error: errorMessage,
    });
  }
});

// ============== LinkedIn Content Generation Endpoints ==============

// Generate LinkedIn content from profile URL
app.post("/generate-content", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("[Server] POST /generate-content received");
    console.log("[Server] Body:", JSON.stringify(req.body, null, 2));

    const { linkedinUrl, forceRefresh, customContext } = req.body;

    if (!linkedinUrl) {
      res.status(400).json({
        status: "error",
        error: "linkedinUrl is required",
      });
      return;
    }

    const result = await executeContentGeneration({
      linkedinUrl,
      forceRefresh: forceRefresh || false,
      customContext,
    });

    const duration = Date.now() - startTime;
    console.log(`[Server] Content generation completed in ${duration}ms`);
    console.log("=".repeat(60) + "\n");

    if (result.success) {
      res.json({
        status: "ok",
        ...result,
      });
    } else {
      res.status(400).json({
        status: "error",
        ...result,
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] Error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      status: "error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get workflow info
app.get("/content-workflow", (_req: Request, res: Response) => {
  res.json({
    id: contentGenerationWorkflow.id,
    name: contentGenerationWorkflow.name,
    description: contentGenerationWorkflow.description,
    steps: contentGenerationWorkflow.steps,
    openai_available: !!process.env.OPENAI_API_KEY,
    gemini_available: isGeminiAvailable(),
    apify_configured: !!(process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN),
  });
});

// Get cached profile
app.get("/profiles/:username", (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const profile = loadProfile(username);

    if (profile) {
      res.json({
        status: "ok",
        ...profile,
      });
    } else {
      res.status(404).json({
        status: "error",
        error: `Profile not found for ${username}`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      status: "error",
      error: errorMessage,
    });
  }
});

// Get cached personality
app.get("/personalities/:username", (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const personality = loadPersonality(username);

    if (personality) {
      res.json({
        status: "ok",
        ...personality,
      });
    } else {
      res.status(404).json({
        status: "error",
        error: `Personality not found for ${username}`,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      status: "error",
      error: errorMessage,
    });
  }
});

// ============== Image Recommender Endpoint ==============

// Recommend a Tal chat screenshot for a LinkedIn post
app.post("/recommend-image", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("[Server] POST /recommend-image received");
    console.log("[Server] Body:", JSON.stringify(req.body, null, 2));

    const { generatedPost, angleUsed, personContext } = req.body;

    if (!generatedPost) {
      res.status(400).json({
        status: "error",
        error: "generatedPost is required",
      });
      return;
    }

    const result = await recommendImage({
      generatedPost,
      angleUsed,
      personContext,
    });

    const duration = Date.now() - startTime;
    console.log(`[Server] Image recommendation completed in ${duration}ms`);
    console.log("=".repeat(60) + "\n");

    res.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] Error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      status: "error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============== LinkedIn Friendly Endpoint ==============

// Optimize a post using viral structures
app.post("/linkedin-friendly", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("[Server] POST /linkedin-friendly received");
    console.log("[Server] Body:", JSON.stringify(req.body, null, 2));

    const { username, generatedPost, altVersion, imageRecommendation, viralPostsCsvPath } = req.body;

    if (!username || !generatedPost) {
      res.status(400).json({
        status: "error",
        error: "username and generatedPost are required",
      });
      return;
    }

    const result = await generateLinkedInFriendly({
      username,
      generatedPost,
      altVersion,
      imageRecommendation,
      viralPostsCsvPath,
    });

    const duration = Date.now() - startTime;
    console.log(`[Server] LinkedIn-friendly optimization completed in ${duration}ms`);
    console.log("=".repeat(60) + "\n");

    res.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Server] Error after ${duration}ms:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      status: "error",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

// List all cached data
app.get("/cached", (_req: Request, res: Response) => {
  try {
    res.json({
      status: "ok",
      profiles: listProfiles(),
      personalities: listPersonalities(),
      generated: listGenerated(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      status: "error",
      error: errorMessage,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log(`Tal Content Engine Server`);
  console.log("=".repeat(60));
  console.log(`Flows:`);
  console.log(`  - ${flowMetadata.name} (image generation)`);
  console.log(`  - ${contentGenerationWorkflow.name} (content generation)`);
  console.log(`Port: ${PORT}`);
  console.log(`OpenAI: ${process.env.OPENAI_API_KEY ? "Configured" : "Not configured"}`);
  console.log(`Gemini: ${isGeminiAvailable() ? "Available" : "Mock mode"}`);
  console.log(`Apify: ${process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN ? "Configured" : "Not configured"}`);
  console.log(`Endpoints:`);
  console.log(`  POST http://localhost:${PORT}/run (image generation)`);
  console.log(`  POST http://localhost:${PORT}/generate-content (LinkedIn content)`);
  console.log(`  POST http://localhost:${PORT}/recommend-image (Tal chat screenshot recommendation)`);
  console.log(`  POST http://localhost:${PORT}/linkedin-friendly (viral structure optimization)`);
  console.log("=".repeat(60) + "\n");
});
