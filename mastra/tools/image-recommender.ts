import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// ============================================
// TOOL INPUT SCHEMA
// ============================================

export const ImageRecommenderInputSchema = z.object({
  // The generated LinkedIn post content
  generatedPost: z.string(),

  // The angle/theme used in the post (optional, helps with matching)
  angleUsed: z.string().optional(),

  // Person's context (optional, for better matching)
  personContext: z.object({
    name: z.string().optional(),
    role: z.string().optional(),
    industry: z.string().optional(),
  }).optional(),
});

export type ImageRecommenderInput = z.infer<typeof ImageRecommenderInputSchema>;

// ============================================
// TOOL OUTPUT SCHEMA
// ============================================

export const ImageRecommenderOutputSchema = z.object({
  // Recommended chat file
  recommendedChat: z.object({
    filename: z.string(),
    userName: z.string(),
    date: z.string(),
    messageCount: z.number(),
  }),

  // Specific message range to screenshot
  screenshotRange: z.object({
    startIndex: z.number(),
    endIndex: z.number(),
    suggestedMessages: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })),
  }),

  // Why this chat was chosen
  matchRationale: z.string(),

  // Theme detected in the post
  postTheme: z.string(),

  // Alternative recommendations
  alternatives: z.array(z.object({
    filename: z.string(),
    userName: z.string(),
    reason: z.string(),
  })),
});

export type ImageRecommenderOutput = z.infer<typeof ImageRecommenderOutputSchema>;

// ============================================
// CHAT SUMMARY TYPE
// ============================================

interface ChatSummary {
  filename: string;
  userName: string;
  date: string;
  messageCount: number;
  themes: string[];
  keyMoments: string[];
  talQuotes: string[];
}

// ============================================
// LOAD ALL CHATS
// ============================================

function loadAllChats(): { filename: string; data: any }[] {
  const chatsDir = path.join(process.cwd(), "data", "tal", "chats");
  const files = fs.readdirSync(chatsDir).filter(f => f.endsWith(".json"));

  return files.map(filename => {
    const content = fs.readFileSync(path.join(chatsDir, filename), "utf-8");
    return {
      filename,
      data: JSON.parse(content),
    };
  });
}

// ============================================
// FIND BEST SCREENSHOT RANGE
// ============================================

function findBestScreenshotRange(messages: any[]): { startIndex: number; endIndex: number } {
  // Keywords that indicate a good Tal moment
  const goodPhrases = [
    "the real risk",
    "ghost story",
    "they're not hiring you for",
    "you didn't just",
    "the only language",
    "luck is for",
    "you're not restless",
    "low tolerance for plateaus",
    "what's really going on",
    "i'll ping you",
    "scanning",
    "50,000",
    "perfect fit",
    "step up",
    "deal",
    "haha",
    "sane people",
    "zone of genius",
  ];

  let bestIndex = -1;
  let bestScore = 0;

  // Find the message with the best Tal quote
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;

    const content = (msg.content || "").toLowerCase();
    if (content.startsWith("{") || content.length < 30) continue;

    let score = 0;
    for (const phrase of goodPhrases) {
      if (content.includes(phrase)) {
        score += 10;
      }
    }

    // Bonus for medium length (good for screenshots)
    if (content.length > 50 && content.length < 300) {
      score += 5;
    }

    // Bonus for having newlines (formatted better)
    if (content.includes("\n")) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // If no good quote found, look for the first meaningful Tal response
  if (bestIndex === -1) {
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "assistant" && msg.content && msg.content.length > 50 && !msg.content.startsWith("{")) {
        bestIndex = i;
        break;
      }
    }
  }

  // Default to middle of conversation
  if (bestIndex === -1) {
    bestIndex = Math.min(10, Math.floor(messages.length / 2));
  }

  // Return a range of 4-5 messages centered on the best quote
  const startIndex = Math.max(0, bestIndex - 2);
  const endIndex = Math.min(messages.length - 1, bestIndex + 2);

  return { startIndex, endIndex };
}

// ============================================
// EXTRACT CHAT THEMES
// ============================================

function extractChatThemes(chat: any): ChatSummary {
  const messages = chat.messages || [];
  const talMessages = messages
    .filter((m: any) => m.role === "assistant")
    .map((m: any) => m.content)
    .filter((c: string) => c && !c.startsWith("{") && c.length > 20);

  // Extract key themes based on content
  const themes: string[] = [];
  const keyMoments: string[] = [];
  const talQuotes: string[] = [];

  const fullText = talMessages.join(" ").toLowerCase();

  // Theme detection
  if (fullText.includes("salary") || fullText.includes("ctc") || fullText.includes("lpa") || fullText.includes("pay")) {
    themes.push("salary-negotiation");
  }
  if (fullText.includes("job hopper") || fullText.includes("switch") || fullText.includes("leave")) {
    themes.push("job-switching");
  }
  if (fullText.includes("learning") || fullText.includes("growth") || fullText.includes("career")) {
    themes.push("career-growth");
  }
  if (fullText.includes("startup") || fullText.includes("founder") || fullText.includes("build")) {
    themes.push("startup-culture");
  }
  if (fullText.includes("honest") || fullText.includes("truth") || fullText.includes("real") || fullText.includes("ghost story")) {
    themes.push("brutal-honesty");
  }
  if (fullText.includes("remote") || fullText.includes("bangalore") || fullText.includes("location")) {
    themes.push("location-preferences");
  }
  if (fullText.includes("experience") || fullText.includes("years") || fullText.includes("senior")) {
    themes.push("experience-level");
  }
  if (fullText.includes("mckinsey") || fullText.includes("google") || fullText.includes("meta") || fullText.includes("faang")) {
    themes.push("big-company");
  }
  if (fullText.includes("1 right") || fullText.includes("perfect fit") || fullText.includes("best 1")) {
    themes.push("focused-search");
  }
  if (fullText.includes("bench") || fullText.includes("boring") || fullText.includes("waste")) {
    themes.push("job-frustration");
  }

  // Extract memorable Tal quotes (good for screenshots)
  for (const msg of talMessages) {
    if (msg.length > 50 && msg.length < 300) {
      // Check for punchy, quotable content
      if (
        msg.includes("the real risk") ||
        msg.includes("ghost story") ||
        msg.includes("they're not hiring you for") ||
        msg.includes("you didn't just") ||
        msg.includes("that's a") ||
        msg.includes("the only language") ||
        msg.includes("luck is for")
      ) {
        talQuotes.push(msg);
        keyMoments.push(msg.substring(0, 100) + "...");
      }
    }
  }

  return {
    filename: "",
    userName: chat.user_name || "Unknown",
    date: chat.date || "",
    messageCount: chat.message_count || messages.length,
    themes,
    keyMoments,
    talQuotes,
  };
}

// ============================================
// SYSTEM PROMPT FOR MATCHING
// ============================================

const IMAGE_RECOMMENDER_SYSTEM_PROMPT = `You are an expert at matching LinkedIn post content with relevant Tal chat screenshots.

Your job is to analyze a LinkedIn post about Tal and recommend which chat conversation would make the best accompanying image.

## MATCHING CRITERIA

1. **Theme Alignment**: The chat should reflect the same theme as the post
   - Post about career honesty → Chat where Tal gives blunt feedback
   - Post about job search → Chat where Tal scans for roles
   - Post about salary → Chat discussing compensation
   - Post about career transitions → Chat about switching jobs

2. **Screenshot-Worthiness**: The chat excerpt should:
   - Be visually clean (not too long, not too short)
   - Have a memorable Tal quote or insight
   - Work as a standalone visual (makes sense without full context)
   - Be 3-6 messages max for the screenshot

3. **Authenticity**: The chat should feel real and relatable
   - Real user questions/responses
   - Natural conversation flow
   - Tal's signature blunt style showing

## OUTPUT FORMAT

Return JSON with:
- recommendedChatIndex: index of best matching chat (0-based)
- startMessageIndex: where to start the screenshot
- endMessageIndex: where to end the screenshot
- matchRationale: why this chat matches the post
- postTheme: the detected theme of the post
- alternativeIndices: [2-3 other good options]

Focus on finding the MOST visually compelling and thematically aligned moment.`;

// ============================================
// MAIN FUNCTION
// ============================================

export async function recommendImage(
  input: ImageRecommenderInput
): Promise<ImageRecommenderOutput> {
  console.log("[image-recommender] Analyzing post and finding matching chat...");

  // Load all chats
  const allChats = loadAllChats();
  console.log(`[image-recommender] Loaded ${allChats.length} chats`);

  // Extract summaries for each chat
  const chatSummaries: (ChatSummary & { index: number; messages: any[] })[] = allChats.map((chat, index) => ({
    ...extractChatThemes(chat.data),
    filename: chat.filename,
    index,
    messages: chat.data.messages || [],
  }));

  // Detect themes in the post to pre-filter chats
  const postLower = input.generatedPost.toLowerCase();
  const postThemes: string[] = [];

  if (postLower.includes("salary") || postLower.includes("pay") || postLower.includes("compensation")) {
    postThemes.push("salary-negotiation");
  }
  if (postLower.includes("honest") || postLower.includes("direct") || postLower.includes("blunt") || postLower.includes("reality")) {
    postThemes.push("brutal-honesty");
  }
  if (postLower.includes("1 right") || postLower.includes("not 100") || postLower.includes("focused") || postLower.includes("perfect fit")) {
    postThemes.push("focused-search");
  }
  if (postLower.includes("switch") || postLower.includes("transition") || postLower.includes("jump")) {
    postThemes.push("job-switching");
  }
  if (postLower.includes("growth") || postLower.includes("career") || postLower.includes("next step")) {
    postThemes.push("career-growth");
  }
  if (postLower.includes("startup") || postLower.includes("build") || postLower.includes("founder")) {
    postThemes.push("startup-culture");
  }

  console.log("[image-recommender] Detected post themes:", postThemes.join(", ") || "general");

  // Score and sort chats by theme relevance
  const scoredChats = chatSummaries.map((summary) => {
    let score = 0;
    // Score based on theme overlap
    for (const theme of postThemes) {
      if (summary.themes.includes(theme)) {
        score += 10;
      }
    }
    // Bonus for having good quotes
    score += summary.talQuotes.length * 2;
    // Bonus for brutal-honesty (always good for Tal posts)
    if (summary.themes.includes("brutal-honesty")) {
      score += 5;
    }
    return { ...summary, score };
  });

  // Sort by score descending, take top 25
  scoredChats.sort((a, b) => b.score - a.score);
  const topChats = scoredChats.slice(0, 25);

  console.log("[image-recommender] Top scoring chats:", topChats.slice(0, 5).map(c => `${c.filename}(${c.score})`).join(", "));

  // Build context for Gemini with only top chats
  const chatsContext = topChats.map((summary, i) => {
    const talQuotesPreview = summary.talQuotes.slice(0, 2).join("\n---\n");
    return `
CHAT ${i}: ${summary.filename}
User: ${summary.userName}
Themes: ${summary.themes.join(", ") || "general"}
Score: ${summary.score}
Sample Tal Quotes:
${talQuotesPreview || "(no standout quotes)"}
`;
  }).join("\n---\n");

  // Call Gemini to find best match
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-pro" });

  const userPrompt = `
## LINKEDIN POST TO MATCH

${input.generatedPost}

${input.angleUsed ? `Angle/Theme Used: ${input.angleUsed}` : ""}
${input.personContext ? `Person Context: ${input.personContext.role || ""} in ${input.personContext.industry || ""}` : ""}

## AVAILABLE CHATS

${chatsContext}

## TASK

Find the best chat to screenshot as the image for this LinkedIn post.
Return the chat index, message range for screenshot, and rationale.

Return valid JSON only:
{
  "recommendedChatIndex": <number>,
  "startMessageIndex": <number>,
  "endMessageIndex": <number>,
  "matchRationale": "<why this chat matches>",
  "postTheme": "<detected theme of the post>",
  "alternativeIndices": [<number>, <number>]
}`;

  let responseText = "";
  try {
    console.log("[image-recommender] Calling Gemini...");
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: IMAGE_RECOMMENDER_SYSTEM_PROMPT + "\n\n" + userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
      },
    });

    responseText = result.response.text();
    console.log("[image-recommender] Gemini response received");
  } catch (geminiError) {
    console.error("[image-recommender] Gemini call failed:", geminiError);
    // Use the top-scored chat as fallback with best screenshot range
    const best = topChats[0];
    const bestRange = findBestScreenshotRange(best.messages);
    return {
      recommendedChat: {
        filename: best.filename,
        userName: best.userName,
        date: best.date,
        messageCount: best.messageCount,
      },
      screenshotRange: {
        startIndex: bestRange.startIndex,
        endIndex: bestRange.endIndex,
        suggestedMessages: best.messages.slice(bestRange.startIndex, bestRange.endIndex + 1).map((m: any) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content.substring(0, 500) : String(m.content).substring(0, 500),
        })),
      },
      matchRationale: `Best scoring chat for themes: ${postThemes.join(", ")}`,
      postTheme: postThemes.join(", ") || "general",
      alternatives: topChats.slice(1, 4).map(c => ({
        filename: c.filename,
        userName: c.userName,
        reason: `Score: ${(c as any).score}, Themes: ${c.themes.join(", ")}`,
      })),
    };
  }
  console.log("[image-recommender] Raw response length:", responseText.length);

  // Parse JSON from response
  let parsed: any;
  try {
    // Clean markdown if present
    let cleanText = responseText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.split("```")[1];
      if (cleanText.startsWith("json")) {
        cleanText = cleanText.slice(4);
      }
      cleanText = cleanText.trim();
    }

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("No JSON found in response");
    }
  } catch (e) {
    console.error("[image-recommender] Failed to parse response:", responseText.substring(0, 500));
    // Fallback to theme-scored chat with best screenshot range
    const best = topChats[0];
    const bestRange = findBestScreenshotRange(best.messages);
    console.log("[image-recommender] Using pre-scored fallback:", best.filename, "range:", bestRange);
    return {
      recommendedChat: {
        filename: best.filename,
        userName: best.userName,
        date: best.date,
        messageCount: best.messageCount,
      },
      screenshotRange: {
        startIndex: bestRange.startIndex,
        endIndex: bestRange.endIndex,
        suggestedMessages: best.messages.slice(bestRange.startIndex, bestRange.endIndex + 1).map((m: any) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content.substring(0, 500) : String(m.content).substring(0, 500),
        })),
      },
      matchRationale: `Best scoring chat (score: ${(best as any).score}) for themes: ${postThemes.join(", ")}`,
      postTheme: postThemes.join(", ") || "general",
      alternatives: topChats.slice(1, 4).map(c => ({
        filename: c.filename,
        userName: c.userName,
        reason: `Score: ${(c as any).score}, Themes: ${c.themes.join(", ")}`,
      })),
    };
  }

  // Get the recommended chat (from topChats, not chatSummaries)
  const recommendedIdx = Math.min(parsed.recommendedChatIndex || 0, topChats.length - 1);
  const recommended = topChats[recommendedIdx];

  // Extract the screenshot range
  const startIdx = Math.max(0, parsed.startMessageIndex || 4);
  const endIdx = Math.min(recommended.messages.length - 1, parsed.endMessageIndex || 8);
  const suggestedMessages = recommended.messages.slice(startIdx, endIdx + 1).map((m: any) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content.substring(0, 500) : String(m.content).substring(0, 500),
  }));

  // Build alternatives (from topChats)
  const alternativeIndices = parsed.alternativeIndices || [];
  const alternatives = alternativeIndices.slice(0, 3).map((idx: number) => {
    const alt = topChats[idx];
    return {
      filename: alt?.filename || "",
      userName: alt?.userName || "",
      reason: `Themes: ${alt?.themes.join(", ") || "general"}`,
    };
  }).filter((a: any) => a.filename);

  console.log(`[image-recommender] Recommended: ${recommended.filename}`);
  console.log(`[image-recommender] Theme: ${parsed.postTheme}`);
  console.log(`[image-recommender] Screenshot range: messages ${startIdx}-${endIdx}`);

  return {
    recommendedChat: {
      filename: recommended.filename,
      userName: recommended.userName,
      date: recommended.date,
      messageCount: recommended.messageCount,
    },
    screenshotRange: {
      startIndex: startIdx,
      endIndex: endIdx,
      suggestedMessages,
    },
    matchRationale: parsed.matchRationale || "",
    postTheme: parsed.postTheme || "",
    alternatives,
  };
}

// ============================================
// EXPORT FOR WORKFLOW
// ============================================

export const imageRecommenderTool = {
  id: "image-recommender",
  description: "Recommends a Tal chat screenshot to accompany a LinkedIn post",
  inputSchema: ImageRecommenderInputSchema,
  outputSchema: ImageRecommenderOutputSchema,
  execute: recommendImage,
};
