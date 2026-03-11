/**
 * Parse the large chat dump CSV and convert to JSON files
 */

import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = '/Users/yashshah/Downloads/tal_chat_dump_2025-12-10T06_05_05.568911083Z.csv';
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'tal', 'chats');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

function extractTextContent(rawContent: string): string {
  // Format 1: {format:2,parts:[{type:text,text:CONTENT}],content:CONTENT}
  // The "content:" field at the end has the clean text

  // Try to extract from "content:" field at the end (most common format)
  // Match: },content:ACTUAL_CONTENT} or ,content:ACTUAL_CONTENT}
  const contentMatch = rawContent.match(/,content:([^}]+)\}$/);
  if (contentMatch) {
    let text = contentMatch[1].trim();
    // Clean up the text
    text = cleanText(text);
    if (text.length > 1) {
      return text;
    }
  }

  // Format 2: Try JSON parse for properly formatted content
  try {
    const parsed = JSON.parse(rawContent);

    if (parsed.parts && Array.isArray(parsed.parts)) {
      for (const part of parsed.parts) {
        if (part.type === 'text' && part.text) {
          return cleanText(part.text);
        }
      }
    }

    if (parsed.content && typeof parsed.content === 'string') {
      return cleanText(parsed.content);
    }

    if (typeof parsed === 'string') {
      return cleanText(parsed);
    }
  } catch {
    // Not valid JSON
  }

  // Format 3: Extract from "text:" inside parts array
  // Match: text:ACTUAL_TEXT}] or text:ACTUAL_TEXT,
  const textInPartsMatch = rawContent.match(/text:([^}]+)\}/);
  if (textInPartsMatch) {
    let text = textInPartsMatch[1].trim();
    // Remove trailing ] if present
    text = text.replace(/\]$/, '');
    text = cleanText(text);
    if (text.length > 1) {
      return text;
    }
  }

  // Format 4: Plain text (no JSON wrapper)
  if (!rawContent.startsWith('{') && !rawContent.startsWith('[')) {
    return cleanText(rawContent);
  }

  // Last resort: return empty to skip this message
  return '';
}

function cleanText(text: string): string {
  // Remove XML message wrappers
  text = text.replace(/<messages>\s*/g, '');
  text = text.replace(/\s*<\/messages>/g, '');
  text = text.replace(/<message[^>]*>/g, '');
  text = text.replace(/<\/message>/g, '');

  // Unescape common escape sequences
  text = text.replace(/\\n/g, '\n');
  text = text.replace(/\\"/g, '"');
  text = text.replace(/\\\\/g, '\\');

  // Remove leading/trailing newlines but preserve internal formatting
  return text.trim();
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  // Clean up quotes
  return fields.map(f => f.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

function parseCSV(csvContent: string): Map<string, Message[]> {
  const conversations = new Map<string, Message[]>();

  const lines = csvContent.split('\n');
  console.log('Header:', lines[0]);

  let parsed = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      const fields = parseCSVLine(line);
      if (fields.length < 6) {
        skipped++;
        continue;
      }

      const [id, thread_id, contentJson, role, type, createdAt] = fields;

      if (!thread_id || !role) {
        skipped++;
        continue;
      }

      // Only keep user and assistant messages
      if (role !== 'user' && role !== 'assistant') {
        skipped++;
        continue;
      }

      // Extract clean text content
      const content = extractTextContent(contentJson);

      if (!content || content.length < 2) {
        skipped++;
        continue;
      }

      // Skip messages that are just tool invocations or system stuff
      if (content.startsWith('{') && content.includes('toolInvocations')) {
        skipped++;
        continue;
      }

      if (!conversations.has(thread_id)) {
        conversations.set(thread_id, []);
      }

      conversations.get(thread_id)!.push({
        role: role as 'user' | 'assistant',
        content,
        createdAt,
      });

      parsed++;
    } catch (e) {
      skipped++;
    }
  }

  console.log(`Parsed ${parsed} messages, skipped ${skipped}`);
  return conversations;
}

function sortMessagesByTime(messages: Message[]): Message[] {
  return messages.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateA - dateB;
  });
}

async function main() {
  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

  console.log('Parsing conversations...');
  const conversations = parseCSV(csvContent);

  console.log(`Found ${conversations.size} unique conversations`);

  // Clear existing chats
  console.log('Clearing existing chats...');
  if (fs.existsSync(OUTPUT_DIR)) {
    const existingFiles = fs.readdirSync(OUTPUT_DIR);
    for (const file of existingFiles) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
  } else {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Filter conversations with at least 4 messages (2 exchanges)
  const validConversations: Array<{ thread_id: string; messages: Message[] }> = [];

  for (const [thread_id, messages] of conversations) {
    const sorted = sortMessagesByTime(messages);

    // Must have at least 4 messages and include both user and assistant
    const hasUser = sorted.some(m => m.role === 'user');
    const hasAssistant = sorted.some(m => m.role === 'assistant');

    if (sorted.length >= 4 && hasUser && hasAssistant) {
      validConversations.push({ thread_id, messages: sorted });
    }
  }

  console.log(`${validConversations.length} conversations have 4+ messages`);

  // Write JSON files
  let written = 0;
  for (let i = 0; i < validConversations.length; i++) {
    const conv = validConversations[i];

    // Extract date from first message
    let date = 'unknown';
    try {
      const firstDate = new Date(conv.messages[0].createdAt);
      date = firstDate.toISOString().split('T')[0];
    } catch {}

    const filename = `chat_${String(i + 1).padStart(4, '0')}_${date}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    const chatData = {
      thread_id: conv.thread_id,
      date,
      message_count: conv.messages.length,
      messages: conv.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    fs.writeFileSync(filepath, JSON.stringify(chatData, null, 2));
    written++;
  }

  console.log(`\nWritten ${written} chat files to ${OUTPUT_DIR}`);

  // Show stats
  const totalMessages = validConversations.reduce((sum, c) => sum + c.messages.length, 0);
  const avgMessages = Math.round(totalMessages / validConversations.length);
  console.log(`Total messages: ${totalMessages}`);
  console.log(`Average messages per chat: ${avgMessages}`);

  // Show sample
  if (validConversations.length > 0) {
    console.log('\n--- SAMPLE CHAT ---');
    const sample = validConversations[0].messages.slice(0, 4);
    for (const m of sample) {
      console.log(`${m.role}: ${m.content.slice(0, 150)}...`);
    }
  }
}

main().catch(console.error);
