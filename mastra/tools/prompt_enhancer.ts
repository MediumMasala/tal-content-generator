/**
 * Prompt Enhancer Tool
 *
 * Transforms user requests into Gemini-friendly, constraint-safe instruction packages.
 * This is the core tool of the Cabal of Strangers workflow.
 */

import { loadTalSystemPrompt } from "./storage";
import { getPromptPackageJsonSchema, type EnhancerOutput } from "../../core/schemas";

// List of known celebrities/politicians/public figures to filter
const PUBLIC_FIGURES = [
  // Politicians
  "trump", "biden", "obama", "modi", "narendra modi", "putin", "xi jinping",
  "macron", "merkel", "boris johnson", "trudeau", "netanyahu",
  // Celebrities
  "taylor swift", "beyonce", "drake", "kanye", "kim kardashian", "elon musk",
  "jeff bezos", "mark zuckerberg", "bill gates", "oprah", "ellen",
  "tom cruise", "brad pitt", "angelina jolie", "leonardo dicaprio",
  "scarlett johansson", "jennifer lawrence", "chris hemsworth", "robert downey",
  "dwayne johnson", "the rock", "vin diesel", "will smith", "denzel washington",
  // Add more as needed
];

interface EnhancerInput {
  user_request: string;
  seed: number | null;
  size: string;
  style_preset: string | null;
  reference_image_id: string;
}

/**
 * Check if the request contains any public figure references
 */
function findPublicFigures(text: string): string[] {
  const lowerText = text.toLowerCase();
  return PUBLIC_FIGURES.filter((figure) => lowerText.includes(figure));
}

/**
 * Remove public figure references from text
 */
function stripPublicFigures(text: string, figures: string[]): string {
  let result = text;
  for (const figure of figures) {
    const regex = new RegExp(figure, "gi");
    result = result.replace(regex, "a person");
  }
  return result;
}

/**
 * Infer missing details from the user request
 */
function inferMissingDetails(request: string): string[] {
  const assumptions: string[] = [];
  const lower = request.toLowerCase();

  // Check for location
  const hasLocation =
    lower.includes("at ") ||
    lower.includes("in ") ||
    lower.includes("cafe") ||
    lower.includes("office") ||
    lower.includes("street") ||
    lower.includes("park") ||
    lower.includes("beach") ||
    lower.includes("home") ||
    lower.includes("room");

  if (!hasLocation) {
    assumptions.push("Inferred location: neutral indoor setting with natural window light");
  }

  // Check for time of day
  const hasTimeOfDay =
    lower.includes("morning") ||
    lower.includes("afternoon") ||
    lower.includes("evening") ||
    lower.includes("night") ||
    lower.includes("sunset") ||
    lower.includes("sunrise") ||
    lower.includes("golden hour");

  if (!hasTimeOfDay) {
    assumptions.push("Inferred time: soft daylight, mid-morning atmosphere");
  }

  // Check for mood
  const hasMood =
    lower.includes("happy") ||
    lower.includes("sad") ||
    lower.includes("serious") ||
    lower.includes("relaxed") ||
    lower.includes("focused") ||
    lower.includes("contemplative") ||
    lower.includes("excited");

  if (!hasMood) {
    assumptions.push("Inferred mood: natural, candid expression");
  }

  return assumptions;
}

/**
 * Build the enhanced user message for Gemini
 */
function buildGeminiUserMessage(
  input: EnhancerInput,
  cleanedRequest: string,
  assumptions: string[]
): string {
  const styleNote = input.style_preset
    ? `Style preset requested: ${input.style_preset} (apply subtly, maintain photorealism)`
    : "No specific style preset - use default photorealistic style";

  const sizeNote = `Output size: ${input.size}`;
  const seedNote = input.seed !== null ? `Seed: ${input.seed}` : "Seed: random (null)";

  return `
User Request: "${cleanedRequest}"

Reference Image ID: ${input.reference_image_id}
${sizeNote}
${seedNote}
${styleNote}

${assumptions.length > 0 ? `Assumptions made:\n${assumptions.map((a) => `- ${a}`).join("\n")}` : ""}

Please generate the PromptPackage JSON that:
1. Creates a photorealistic camera photo prompt
2. Locks identity to ${input.reference_image_id}
3. Includes comprehensive negative prompt
4. Notes any policy enforcement actions

Output ONLY valid JSON matching the schema.
`.trim();
}

/**
 * Main prompt enhancer function
 */
export function enhancePrompt(input: EnhancerInput): EnhancerOutput {
  const enhancerNotes: string[] = [];
  const policyNotes: string[] = [];

  // Step 1: Check for public figures
  const foundFigures = findPublicFigures(input.user_request);
  let cleanedRequest = input.user_request;

  if (foundFigures.length > 0) {
    cleanedRequest = stripPublicFigures(input.user_request, foundFigures);
    const removedNote = `Removed public figure references: ${foundFigures.join(", ")}`;
    enhancerNotes.push(removedNote);
    policyNotes.push(removedNote);
  }

  // Step 2: Infer missing details
  const assumptions = inferMissingDetails(cleanedRequest);
  enhancerNotes.push(...assumptions);

  // Step 3: Load system prompt
  const systemPrompt = loadTalSystemPrompt();

  // Step 4: Build user message
  const userMessage = buildGeminiUserMessage(input, cleanedRequest, assumptions);

  // Step 5: Get JSON schema for response
  const responseSchema = getPromptPackageJsonSchema();

  return {
    gemini_system_prompt: systemPrompt,
    gemini_user_message: userMessage,
    response_json_schema: responseSchema,
    enhancer_notes: enhancerNotes,
  };
}

/**
 * Mastra tool definition for prompt_enhancer
 */
export const promptEnhancerTool = {
  name: "prompt_enhancer",
  description: "Enhances user prompts into Gemini-friendly, constraint-safe instruction packages",
  execute: enhancePrompt,
};
