/**
 * Cabal of Strangers Flow
 *
 * Mastra-style workflow: user_request → prompt_enhancer → gemini_call → output_dispatcher
 */

import { v4 as uuidv4 } from "uuid";
import { enhancePrompt } from "./tools/prompt_enhancer";
import { dispatchOutput } from "./tools/output_dispatcher";
import { callGemini, isGeminiAvailable } from "./gemini/client";
import { RunRequestSchema, type RunRequest, type DispatcherOutput } from "../core/schemas";

/**
 * Execute the full Cabal of Strangers workflow
 */
export async function executeFlow(rawInput: unknown): Promise<DispatcherOutput> {
  // Step 0: Validate and parse input
  const input = RunRequestSchema.parse(rawInput);
  const runId = uuidv4();

  console.log(`[Flow] Starting cabal_of_strangers_v1 (run_id: ${runId})`);
  console.log(`[Flow] User request: "${input.user_request}"`);
  console.log(`[Flow] Gemini available: ${isGeminiAvailable()}`);

  // Step 1: Call PROMPT_ENHANCER tool
  console.log("[Flow] Step 1: Calling prompt_enhancer...");
  const enhancerOutput = enhancePrompt({
    user_request: input.user_request,
    seed: input.seed,
    size: input.size,
    style_preset: input.style_preset,
    reference_image_id: "TAL_ANCHOR_IMAGE",
  });
  console.log(`[Flow] Enhancer notes: ${enhancerOutput.enhancer_notes.length} items`);

  // Step 2: Call Gemini (MODEL_CALL)
  console.log("[Flow] Step 2: Calling Gemini...");
  const geminiOutput = await callGemini({
    systemPrompt: enhancerOutput.gemini_system_prompt,
    userMessage: enhancerOutput.gemini_user_message,
    schema: enhancerOutput.response_json_schema,
    seed: input.seed,
  });
  console.log(`[Flow] Gemini output: ${geminiOutput.final_prompt.slice(0, 50)}...`);

  // Step 3: Call OUTPUT_DISPATCHER tool
  console.log("[Flow] Step 3: Calling output_dispatcher...");
  const dispatcherOutput = dispatchOutput({
    run_id: runId,
    request: {
      user_request: input.user_request,
      seed: input.seed,
      size: input.size,
      style_preset: input.style_preset,
    },
    enhancer_output: enhancerOutput,
    gemini_output: geminiOutput,
  });

  console.log(`[Flow] Completed (run_id: ${runId})`);
  return dispatcherOutput;
}

/**
 * Flow metadata
 */
export const flowMetadata = {
  name: "cabal_of_strangers_v1",
  description: "TAL Image Generator workflow with prompt enhancement and Gemini",
  tools: ["prompt_enhancer", "output_dispatcher"],
  modelCalls: ["gemini"],
};
