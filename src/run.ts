#!/usr/bin/env npx tsx

/**
 * CLI Runner for Tal Content Generation
 *
 * Usage:
 *   npx tsx src/run.ts --linkedin "https://linkedin.com/in/username"
 *   npx tsx src/run.ts --linkedin "https://linkedin.com/in/username" --refresh
 *   npx tsx src/run.ts --linkedin "https://linkedin.com/in/username" --context "Extra context"
 */

import { executeContentGeneration } from "../mastra/workflows/content-generation";
import { listProfiles, listPersonalities, listGenerated } from "../mastra/storage/local-storage";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface CliArgs {
  linkedinUrl?: string;
  forceRefresh: boolean;
  customContext?: string;
  listProfiles: boolean;
  listPersonalities: boolean;
  listGenerated: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    forceRefresh: false,
    listProfiles: false,
    listPersonalities: false,
    listGenerated: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--linkedin":
      case "-l":
        args.linkedinUrl = argv[++i];
        break;
      case "--refresh":
      case "-r":
        args.forceRefresh = true;
        break;
      case "--context":
      case "-c":
        args.customContext = argv[++i];
        break;
      case "--list-profiles":
        args.listProfiles = true;
        break;
      case "--list-personalities":
        args.listPersonalities = true;
        break;
      case "--list-generated":
        args.listGenerated = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Tal Content Generation CLI

USAGE:
  npx tsx src/run.ts --linkedin <url> [options]
  npx tsx src/run.ts --list-profiles
  npx tsx src/run.ts --list-generated

OPTIONS:
  --linkedin, -l <url>     LinkedIn profile URL to process
  --refresh, -r            Force refresh (re-scrape and re-analyze)
  --context, -c <text>     Additional context for content generation
  --list-profiles          List all cached profiles
  --list-personalities     List all cached personalities
  --list-generated         List all generated content
  --help, -h               Show this help message

EXAMPLES:
  npx tsx src/run.ts --linkedin "https://linkedin.com/in/saumiltripathi"
  npx tsx src/run.ts -l "https://linkedin.com/in/saumiltripathi" -r
  npx tsx src/run.ts -l "https://linkedin.com/in/saumiltripathi" -c "Focus on AI angle"

ENVIRONMENT:
  APIFY_API_TOKEN     Required for LinkedIn scraping
  GEMINI_API_KEY      Required for personality analysis and content generation
`);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Handle list commands
  if (args.listProfiles) {
    const profiles = listProfiles();
    console.log("\nCached Profiles:");
    if (profiles.length === 0) {
      console.log("  (none)");
    } else {
      profiles.forEach((p) => console.log(`  - ${p}`));
    }
    process.exit(0);
  }

  if (args.listPersonalities) {
    const personalities = listPersonalities();
    console.log("\nCached Personalities:");
    if (personalities.length === 0) {
      console.log("  (none)");
    } else {
      personalities.forEach((p) => console.log(`  - ${p}`));
    }
    process.exit(0);
  }

  if (args.listGenerated) {
    const generated = listGenerated();
    console.log("\nGenerated Content:");
    if (generated.length === 0) {
      console.log("  (none)");
    } else {
      generated.forEach((g) => console.log(`  - ${g}`));
    }
    process.exit(0);
  }

  // Validate LinkedIn URL
  if (!args.linkedinUrl) {
    console.error("Error: LinkedIn URL is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  // Check environment variables
  if (!process.env.APIFY_API_TOKEN && !process.env.APIFY_TOKEN) {
    console.error("Error: APIFY_API_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("  TAL CONTENT GENERATION");
  console.log("========================================\n");

  console.log(`LinkedIn URL: ${args.linkedinUrl}`);
  console.log(`Force Refresh: ${args.forceRefresh}`);
  if (args.customContext) {
    console.log(`Custom Context: ${args.customContext}`);
  }
  console.log("");

  try {
    const result = await executeContentGeneration({
      linkedinUrl: args.linkedinUrl,
      forceRefresh: args.forceRefresh,
      customContext: args.customContext,
    });

    if (!result.success) {
      console.error("\n========================================");
      console.error("  ERROR");
      console.error("========================================");
      console.error(`Step: ${(result as any).step}`);
      console.error(`Error: ${(result as any).error}`);
      process.exit(1);
    }

    console.log("\n========================================");
    console.log("  RESULTS");
    console.log("========================================\n");

    console.log(`Person: ${result.personName || result.username}`);
    console.log(`Confidence Score: ${result.confidenceScore}/100`);
    console.log(`Writing Style Available: ${result.writingStyleAvailable ? "Yes" : "No"}`);
    console.log(`Angle Used: ${result.angleUsed}`);

    console.log("\n--- GENERATED CONTENT ---\n");
    console.log(result.content);

    console.log("\n--- PERSONALIZATION NOTES ---\n");
    console.log(result.personalizationNotes);

    console.log("\n--- STORAGE PATHS ---\n");
    console.log(`Profile: ${result.storagePaths.profile}`);
    console.log(`Personality: ${result.storagePaths.personality}`);
    console.log(`Generated: ${result.storagePaths.generated}`);

    console.log("\n--- TIMING ---\n");
    console.log(`Extraction: ${result.timing.extractionMs}ms`);
    console.log(`Personality: ${result.timing.personalityMs}ms`);
    console.log(`Generation: ${result.timing.generationMs}ms`);
    console.log(`Total: ${result.timing.totalMs}ms`);

    console.log("\n========================================\n");
  } catch (error) {
    console.error("\nUnexpected error:", error);
    process.exit(1);
  }
}

main();
