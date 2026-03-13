import * as fs from 'fs';
import * as path from 'path';

/**
 * Local Storage Helpers
 *
 * Simple JSON file-based storage for profiles, personalities, and generated content.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const PROFILES_DIR = path.join(DATA_DIR, 'profiles');
const PERSONALITIES_DIR = path.join(DATA_DIR, 'personalities');
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const TAL_DIR = path.join(DATA_DIR, 'tal');

// Ensure directories exist
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Initialize all directories
export function initStorage(): void {
  ensureDir(DATA_DIR);
  ensureDir(PROFILES_DIR);
  ensureDir(PERSONALITIES_DIR);
  ensureDir(GENERATED_DIR);
  ensureDir(TAL_DIR);
}

// Extract username from LinkedIn URL
export function extractUsername(linkedinUrl: string): string {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  if (!match) {
    throw new Error(`Invalid LinkedIn URL: ${linkedinUrl}`);
  }
  return match[1].toLowerCase();
}

// ============================================
// PROFILE STORAGE
// ============================================

export function saveProfile(username: string, data: any): string {
  ensureDir(PROFILES_DIR);
  const filePath = path.join(PROFILES_DIR, `${username}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function loadProfile(username: string): any | null {
  const filePath = path.join(PROFILES_DIR, `${username}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function listProfiles(): string[] {
  ensureDir(PROFILES_DIR);
  const files = fs.readdirSync(PROFILES_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ============================================
// PERSONALITY STORAGE
// ============================================

export function savePersonality(username: string, data: any): string {
  ensureDir(PERSONALITIES_DIR);
  const filePath = path.join(PERSONALITIES_DIR, `${username}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function loadPersonality(username: string): any | null {
  const filePath = path.join(PERSONALITIES_DIR, `${username}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function listPersonalities(): string[] {
  ensureDir(PERSONALITIES_DIR);
  const files = fs.readdirSync(PERSONALITIES_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

// ============================================
// GENERATED CONTENT STORAGE
// ============================================

export function saveGenerated(username: string, data: any): string {
  ensureDir(GENERATED_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(GENERATED_DIR, `${username}_${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function loadGenerated(username: string): any[] {
  ensureDir(GENERATED_DIR);
  const files = fs.readdirSync(GENERATED_DIR);
  const userFiles = files.filter(f => f.startsWith(`${username}_`) && f.endsWith('.json'));

  return userFiles.map(f => {
    const content = fs.readFileSync(path.join(GENERATED_DIR, f), 'utf-8');
    return JSON.parse(content);
  });
}

export function listGenerated(): string[] {
  ensureDir(GENERATED_DIR);
  const files = fs.readdirSync(GENERATED_DIR);
  return files.filter(f => f.endsWith('.json'));
}

// ============================================
// TAL CONTEXT STORAGE
// ============================================

export function loadTalContext(): {
  systemPrompt: string | null;
  lore: string | null;
  chats: any[];
} {
  ensureDir(TAL_DIR);

  // Load system prompt
  let systemPrompt: string | null = null;
  const systemPromptPath = path.join(TAL_DIR, 'system-prompt.txt');
  if (fs.existsSync(systemPromptPath)) {
    systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');
  }

  // Load lore
  let lore: string | null = null;
  const lorePath = path.join(TAL_DIR, 'lore.txt');
  if (fs.existsSync(lorePath)) {
    lore = fs.readFileSync(lorePath, 'utf-8');
  }

  // Load chats
  const chats: any[] = [];
  const chatsDir = path.join(TAL_DIR, 'chats');
  if (fs.existsSync(chatsDir)) {
    const chatFiles = fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'));
    for (const file of chatFiles) {
      try {
        const content = fs.readFileSync(path.join(chatsDir, file), 'utf-8');
        const chatData = JSON.parse(content);
        chats.push({ filename: file, content: chatData });
      } catch (e) {
        console.warn(`Failed to load chat file ${file}:`, e);
      }
    }
  }

  return { systemPrompt, lore, chats };
}

export function loadRawPosts(username: string): { data: any[] } | null {
  const profile = loadProfile(username);
  if (!profile || !profile.profile?.posts) {
    return null;
  }
  return { data: profile.profile.posts };
}

// Initialize on module load
initStorage();
