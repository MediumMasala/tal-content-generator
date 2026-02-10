/**
 * Storage utilities for file I/O operations
 */

import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = process.env.OUTPUT_DIR || "./outputs";

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the run directory path for a given run_id
 */
export function getRunDir(runId: string): string {
  return path.join(OUTPUT_DIR, "runs", runId);
}

/**
 * Read text content from a file
 */
export function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write JSON object to a file
 */
export function writeJson(filePath: string, obj: unknown): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

/**
 * Append a JSON object as a line to a JSONL file
 */
export function appendJsonl(filePath: string, obj: unknown): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const line = JSON.stringify({ ...obj as object, timestamp: new Date().toISOString() }) + "\n";
  fs.appendFileSync(filePath, line, "utf-8");
}

/**
 * Read JSON from a file
 */
export function readJson<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Get the path to the core directory
 */
export function getCoreDir(): string {
  return path.resolve(__dirname, "../../core");
}

/**
 * Load the TAL prompt enhancer system prompt
 */
export function loadTalSystemPrompt(): string {
  const promptPath = path.join(getCoreDir(), "tal_prompt_enhancer.md");
  return readText(promptPath);
}
