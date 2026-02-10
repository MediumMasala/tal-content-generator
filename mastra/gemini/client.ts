/**
 * Gemini Client
 *
 * Wrapper for Google Gemini API with mock fallback.
 */

import { PromptPackageSchema, type PromptPackage } from "../../core/schemas";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

interface GeminiCallInput {
  systemPrompt: string;
  userMessage: string;
  schema: object;
  seed?: number | null;
}

/**
 * Default negative prompt for TAL photoreal mascot
 */
const DEFAULT_NEGATIVE_PROMPT =
  "2d cartoon, anime, illustration, comic, painting, sketch, pixar, disney, " +
  "animated movie still, cgi render, unreal engine, overly stylized, toy, plush, " +
  "chibi, plastic, low detail, flat shading, neon outlines, exaggerated proportions, " +
  "studio render background, watermark, text, letters, logos, brand marks, " +
  "celebrity, politician, public figure, lookalike";

/**
 * Generate a mock PromptPackage based on user message
 */
function generateMockResponse(userMessage: string, seed: number | null): PromptPackage {
  // Extract the user request from the message
  const requestMatch = userMessage.match(/User Request: "([^"]+)"/);
  const userRequest = requestMatch ? requestMatch[1] : "TAL in a scene";

  // Extract size
  const sizeMatch = userMessage.match(/Output size: (\d+x\d+)/);
  const size = sizeMatch ? sizeMatch[1] : "1024x1024";

  // Build a photoreal mascot prompt
  const finalPrompt =
    `Photorealistic lifestyle photograph of TAL, a 3D mascot character, in a real-world location. ` +
    `TAL character must match TAL_ANCHOR_IMAGE exactly (identity lock) - same fur color palette, ` +
    `facial proportions, eye style, muzzle shape, outfit vibe. ` +
    `Scene: ${userRequest}. ` +
    `Natural lighting + realistic shadows. Shot on DSLR, shallow depth of field, subtle film grain. ` +
    `High-end brand mascot photography feel. Realistic textures - detailed fur, fabric weave, natural shadow falloff.`;

  return {
    final_prompt: finalPrompt,
    negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    reference_image_ids: ["TAL_ANCHOR_IMAGE"],
    reference_strength: 0.92,
    size,
    n: 1,
    seed,
    assumptions: [
      "Mock mode: Generated photoreal mascot prompt",
      "Applied real-world photography style",
      "Maintained TAL identity lock",
    ],
    policy_notes: ["Running in mock mode (no GEMINI_API_KEY)"],
  };
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiResponse(responseText: string): PromptPackage {
  // Remove markdown code blocks if present
  let cleanText = responseText.trim();
  if (cleanText.startsWith("```")) {
    cleanText = cleanText.split("```")[1];
    if (cleanText.startsWith("json")) {
      cleanText = cleanText.slice(4);
    }
    cleanText = cleanText.trim();
  }

  // Parse JSON
  const parsed = JSON.parse(cleanText);

  // Validate with Zod schema
  const validated = PromptPackageSchema.parse(parsed);

  return validated;
}

/**
 * Call Gemini API with retry logic
 */
async function callGeminiApi(
  input: GeminiCallInput,
  isRetry = false
): Promise<PromptPackage> {
  // Dynamic import to avoid issues if package not installed
  const { GoogleGenerativeAI } = await import("@google/generative-ai");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let prompt = input.userMessage;
  if (isRetry) {
    prompt += "\n\nIMPORTANT: Return ONLY valid JSON matching the schema. Fix any previous errors. No markdown, no explanation.";
  }

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${input.systemPrompt}\n\n${prompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2000,
    },
  });

  const responseText = result.response.text();
  return parseGeminiResponse(responseText);
}

/**
 * Main Gemini call function with mock fallback
 */
export async function callGemini(input: GeminiCallInput): Promise<PromptPackage> {
  // Check for API key
  if (!GEMINI_API_KEY) {
    console.log("[Gemini] No API key found, using mock mode");
    return generateMockResponse(input.userMessage, input.seed ?? null);
  }

  try {
    // First attempt
    console.log(`[Gemini] Calling ${GEMINI_MODEL}...`);
    const result = await callGeminiApi(input);
    console.log("[Gemini] Successfully parsed response");
    return result;
  } catch (firstError) {
    console.warn("[Gemini] First attempt failed, retrying...", firstError);

    try {
      // Retry with explicit instructions
      const result = await callGeminiApi(input, true);
      console.log("[Gemini] Retry successful");
      return result;
    } catch (retryError) {
      console.error("[Gemini] Retry failed, falling back to safe response", retryError);

      // Fallback to mock with policy note
      const mockResponse = generateMockResponse(input.userMessage, input.seed ?? null);
      mockResponse.policy_notes.push(
        `Gemini validation failed: ${retryError instanceof Error ? retryError.message : "Unknown error"}`
      );
      return mockResponse;
    }
  }
}

/**
 * Check if Gemini is available (has API key)
 */
export function isGeminiAvailable(): boolean {
  return Boolean(GEMINI_API_KEY);
}
