/**
 * Output Dispatcher Tool
 *
 * Persists workflow outputs and returns Streamlit payload.
 */

import * as path from "path";
import {
  getRunDir,
  writeJson,
  appendJsonl,
  ensureDir,
} from "./storage";
import type { EnhancerOutput, PromptPackage, DispatcherOutput } from "../../core/schemas";

interface DispatcherInput {
  run_id: string;
  request: {
    user_request: string;
    seed: number | null;
    size: string;
    style_preset: string | null;
  };
  enhancer_output: EnhancerOutput;
  gemini_output: PromptPackage;
}

/**
 * Log an event to the events.jsonl file
 */
function logEvent(runDir: string, event: string, data?: unknown): void {
  const eventsPath = path.join(runDir, "events.jsonl");
  appendJsonl(eventsPath, { event, data });
}

/**
 * Dispatch outputs: persist files and return Streamlit payload
 */
export function dispatchOutput(input: DispatcherInput): DispatcherOutput {
  const runDir = getRunDir(input.run_id);
  ensureDir(runDir);

  // Define file paths
  const paths = {
    request: path.join(runDir, "request.json"),
    enhancer_output: path.join(runDir, "enhancer_output.json"),
    gemini_output: path.join(runDir, "gemini_output.json"),
    events: path.join(runDir, "events.jsonl"),
  };

  // Log flow start
  logEvent(runDir, "flow_started", { run_id: input.run_id });

  // Persist request
  writeJson(paths.request, input.request);
  logEvent(runDir, "request_saved", { path: paths.request });

  // Persist enhancer output (without the full system prompt to save space)
  const enhancerSummary = {
    gemini_user_message: input.enhancer_output.gemini_user_message,
    enhancer_notes: input.enhancer_output.enhancer_notes,
    schema_provided: true,
  };
  writeJson(paths.enhancer_output, enhancerSummary);
  logEvent(runDir, "enhancer_output_saved", { path: paths.enhancer_output });

  // Persist Gemini output (the PromptPackage)
  writeJson(paths.gemini_output, input.gemini_output);
  logEvent(runDir, "gemini_output_saved", { path: paths.gemini_output });

  // Log flow completion
  logEvent(runDir, "flow_completed", {
    run_id: input.run_id,
    final_prompt_length: input.gemini_output.final_prompt.length,
    policy_notes_count: input.gemini_output.policy_notes.length,
  });

  // Return Streamlit payload
  return {
    status: "ok",
    streamlit_payload: {
      run_id: input.run_id,
      prompt_package: input.gemini_output,
      paths: {
        request: paths.request,
        enhancer_output: paths.enhancer_output,
        gemini_output: paths.gemini_output,
        events: paths.events,
      },
    },
  };
}

/**
 * Mastra tool definition for output_dispatcher
 */
export const outputDispatcherTool = {
  name: "output_dispatcher",
  description: "Persists workflow outputs and returns Streamlit-ready payload",
  execute: dispatchOutput,
};
