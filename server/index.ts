/**
 * Express Server for Cabal of Strangers
 *
 * Exposes POST /run endpoint for Streamlit
 */

// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import { executeFlow, flowMetadata } from "../mastra/flow";
import { isGeminiAvailable } from "../mastra/gemini/client";

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

// Start server
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log(`Cabal of Strangers Server`);
  console.log("=".repeat(60));
  console.log(`Flow: ${flowMetadata.name}`);
  console.log(`Port: ${PORT}`);
  console.log(`Gemini: ${isGeminiAvailable() ? "Available" : "Mock mode"}`);
  console.log(`Endpoint: POST http://localhost:${PORT}/run`);
  console.log("=".repeat(60) + "\n");
});
