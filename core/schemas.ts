/**
 * Zod schemas for the Cabal of Strangers workflow
 */

import { z } from "zod";

// Input from Streamlit
export const RunRequestSchema = z.object({
  user_request: z.string().min(1, "User request is required"),
  seed: z.number().nullable().default(null),
  size: z.string().default("1024x1024"),
  style_preset: z.string().nullable().default(null),
});

export type RunRequest = z.infer<typeof RunRequestSchema>;

// Output from prompt_enhancer tool
export const EnhancerOutputSchema = z.object({
  gemini_system_prompt: z.string(),
  gemini_user_message: z.string(),
  response_json_schema: z.record(z.any()),
  enhancer_notes: z.array(z.string()),
});

export type EnhancerOutput = z.infer<typeof EnhancerOutputSchema>;

// Output from Gemini (the PromptPackage)
export const PromptPackageSchema = z.object({
  final_prompt: z.string(),
  negative_prompt: z.string(),
  reference_image_ids: z.array(z.string()),
  reference_strength: z.number().min(0).max(1).default(0.85),
  size: z.string(),
  n: z.number().int().positive().default(1),
  seed: z.number().nullable().default(null),
  assumptions: z.array(z.string()),
  policy_notes: z.array(z.string()),
});

export type PromptPackage = z.infer<typeof PromptPackageSchema>;

// Output dispatcher result
export const DispatcherOutputSchema = z.object({
  status: z.literal("ok"),
  streamlit_payload: z.object({
    run_id: z.string(),
    prompt_package: PromptPackageSchema,
    paths: z.object({
      request: z.string(),
      enhancer_output: z.string(),
      gemini_output: z.string(),
      events: z.string(),
    }),
  }),
});

export type DispatcherOutput = z.infer<typeof DispatcherOutputSchema>;

// Full flow input
export const FlowInputSchema = z.object({
  user_request: z.string(),
  seed: z.number().nullable(),
  size: z.string(),
  style_preset: z.string().nullable(),
  reference_image_id: z.string().default("TAL_ANCHOR_IMAGE"),
});

export type FlowInput = z.infer<typeof FlowInputSchema>;

/**
 * Export PromptPackage schema as JSON Schema for Gemini
 */
export function getPromptPackageJsonSchema(): object {
  return {
    type: "object",
    properties: {
      final_prompt: {
        type: "string",
        description:
          "Complete photorealistic prompt for image generation, identity-locked to TAL_ANCHOR_IMAGE",
      },
      negative_prompt: {
        type: "string",
        description:
          "Negative prompt to avoid cartoon/anime/illustration/CGI styles",
      },
      reference_image_ids: {
        type: "array",
        items: { type: "string" },
        description: "Must include TAL_ANCHOR_IMAGE for identity lock",
      },
      reference_strength: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "How strongly to match reference (0.85 default, up to 0.95 for high drift risk)",
      },
      size: {
        type: "string",
        description: "Output image dimensions (e.g., 1024x1024)",
      },
      n: {
        type: "integer",
        minimum: 1,
        description: "Number of images to generate",
      },
      seed: {
        type: ["number", "null"],
        description: "Random seed for reproducibility",
      },
      assumptions: {
        type: "array",
        items: { type: "string" },
        description: "Assumptions made about ambiguous parts of the request",
      },
      policy_notes: {
        type: "array",
        items: { type: "string" },
        description: "Policy enforcement notes (removed celebrities, etc.)",
      },
    },
    required: [
      "final_prompt",
      "negative_prompt",
      "reference_image_ids",
      "reference_strength",
      "size",
      "n",
      "seed",
      "assumptions",
      "policy_notes",
    ],
    additionalProperties: false,
  };
}
