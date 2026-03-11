import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export interface StorageOptions {
  pretty?: boolean;
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get path for profiles directory
 */
export function getProfilesDir(): string {
  const dir = path.join(DATA_DIR, "profiles");
  ensureDir(dir);
  return dir;
}

/**
 * Get path for personalities directory
 */
export function getPersonalitiesDir(): string {
  const dir = path.join(DATA_DIR, "personalities");
  ensureDir(dir);
  return dir;
}

/**
 * Get path for generated content directory
 */
export function getGeneratedDir(): string {
  const dir = path.join(DATA_DIR, "generated");
  ensureDir(dir);
  return dir;
}

/**
 * Get path for raw Apify data directory
 */
export function getRawDir(): string {
  const dir = path.join(DATA_DIR, "raw");
  ensureDir(dir);
  return dir;
}

/**
 * Get raw profile file path for a username
 */
export function getRawProfilePath(username: string): string {
  return path.join(getRawDir(), `${username}_profile.json`);
}

/**
 * Get raw posts file path for a username
 */
export function getRawPostsPath(username: string): string {
  return path.join(getRawDir(), `${username}_posts.json`);
}

/**
 * Save raw Apify profile data
 */
export function saveRawProfile(username: string, data: any): string {
  const filePath = getRawProfilePath(username);
  writeJson(filePath, data, { pretty: true });
  return filePath;
}

/**
 * Save raw Apify posts data
 */
export function saveRawPosts(username: string, data: any): string {
  const filePath = getRawPostsPath(username);
  writeJson(filePath, data, { pretty: true });
  return filePath;
}

/**
 * Load raw profile from storage
 */
export function loadRawProfile(username: string): any | null {
  return readJson(getRawProfilePath(username));
}

/**
 * Load raw posts from storage
 */
export function loadRawPosts(username: string): any | null {
  return readJson(getRawPostsPath(username));
}

/**
 * Extract username from LinkedIn URL
 */
export function extractUsername(linkedinUrl: string): string {
  // Handle various LinkedIn URL formats
  const patterns = [
    /linkedin\.com\/in\/([^\/\?]+)/,
    /linkedin\.com\/pub\/([^\/\?]+)/,
  ];

  for (const pattern of patterns) {
    const match = linkedinUrl.match(pattern);
    if (match) {
      return match[1].toLowerCase().replace(/[^a-z0-9-]/g, "");
    }
  }

  throw new Error(`Could not extract username from LinkedIn URL: ${linkedinUrl}`);
}

/**
 * Get profile file path for a username
 */
export function getProfilePath(username: string): string {
  return path.join(getProfilesDir(), `${username}.json`);
}

/**
 * Get personality file path for a username
 */
export function getPersonalityPath(username: string): string {
  return path.join(getPersonalitiesDir(), `${username}.json`);
}

/**
 * Get generated content file path for a username
 */
export function getGeneratedPath(username: string, timestamp?: string): string {
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(getGeneratedDir(), `${username}_${ts}.json`);
}

/**
 * Check if a profile exists for a username
 */
export function profileExists(username: string): boolean {
  return fs.existsSync(getProfilePath(username));
}

/**
 * Check if a personality exists for a username
 */
export function personalityExists(username: string): boolean {
  return fs.existsSync(getPersonalityPath(username));
}

/**
 * Read JSON file
 */
export function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Error reading JSON from ${filePath}:`, error);
    return null;
  }
}

/**
 * Write JSON file
 */
export function writeJson<T>(filePath: string, data: T, options: StorageOptions = {}): void {
  ensureDir(path.dirname(filePath));
  const content = options.pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Load profile from storage
 */
export function loadProfile(username: string): any | null {
  return readJson(getProfilePath(username));
}

/**
 * Save profile to storage
 */
export function saveProfile(username: string, profile: any): string {
  const filePath = getProfilePath(username);
  writeJson(filePath, profile, { pretty: true });
  return filePath;
}

/**
 * Load personality from storage
 */
export function loadPersonality(username: string): any | null {
  return readJson(getPersonalityPath(username));
}

/**
 * Save personality to storage
 */
export function savePersonality(username: string, personality: any): string {
  const filePath = getPersonalityPath(username);
  writeJson(filePath, personality, { pretty: true });
  return filePath;
}

/**
 * Save generated content to storage
 */
export function saveGenerated(username: string, content: any): string {
  const filePath = getGeneratedPath(username);
  writeJson(filePath, content, { pretty: true });
  return filePath;
}

/**
 * List all profiles
 */
export function listProfiles(): string[] {
  const dir = getProfilesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/**
 * List all personalities
 */
export function listPersonalities(): string[] {
  const dir = getPersonalitiesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}

/**
 * List generated content for a username
 */
export function listGenerated(username?: string): string[] {
  const dir = getGeneratedDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (username) {
    return files.filter((f) => f.startsWith(`${username}_`));
  }
  return files;
}

// ============================================
// TAL CONTEXT LOADING
// ============================================

/**
 * Get path for Tal context directory
 */
export function getTalDir(): string {
  const dir = path.join(DATA_DIR, "tal");
  ensureDir(dir);
  return dir;
}

/**
 * Get path for Tal chats directory
 */
export function getTalChatsDir(): string {
  const dir = path.join(getTalDir(), "chats");
  ensureDir(dir);
  return dir;
}

/**
 * Read a text/markdown file
 */
export function readTextFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Load Tal's system prompt
 */
export function loadTalSystemPrompt(): string | null {
  const filePath = path.join(getTalDir(), "system-prompt.md");
  return readTextFile(filePath);
}

/**
 * Load Tal's lore/backstory
 */
export function loadTalLore(): string | null {
  const filePath = path.join(getTalDir(), "lore.md");
  return readTextFile(filePath);
}

/**
 * Load all Tal chat examples
 */
export function loadTalChats(): Array<{ filename: string; content: any }> {
  const chatsDir = getTalChatsDir();
  if (!fs.existsSync(chatsDir)) return [];

  const chatFiles = fs.readdirSync(chatsDir).filter(f => f.endsWith(".json"));
  const chats: Array<{ filename: string; content: any }> = [];

  for (const file of chatFiles) {
    const content = readJson(path.join(chatsDir, file));
    if (content) {
      chats.push({ filename: file, content });
    }
  }

  return chats;
}

/**
 * Load complete Tal context (system prompt + lore + chats)
 */
export function loadTalContext(): {
  systemPrompt: string | null;
  lore: string | null;
  chats: Array<{ filename: string; content: any }>;
  available: boolean;
} {
  const systemPrompt = loadTalSystemPrompt();
  const lore = loadTalLore();
  const chats = loadTalChats();

  return {
    systemPrompt,
    lore,
    chats,
    available: !!(systemPrompt || lore || chats.length > 0),
  };
}
