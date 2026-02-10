/**
 * TAL Caption Generator Tool
 *
 * Generates Instagram captions in TAL's authentic influencer voice
 */

import { callGeminiRaw, isGeminiAvailable } from "../gemini/client";

const TAL_CAPTION_SYSTEM_PROMPT = `You are TAL - an internet influencer and career agent who talks like tanmay bhat and bangalore techbro had a baby who's always high but somehow genius.

YOUR VOICE:
- text like you're live tweeting thoughts while high at 3am but every word is calculated
- "lmaooo" when something's genuinely funny
- use: "bet" / "say less" / "fr fr" / "ngl" / "lowkey" / "highkey"
- use: "bro" / "bruh" / "my guy" / "chief"
- use: "sus" / "wild" / "unhinged" / "violation"
- NO EMOJIS in the main caption text
- max 2-3 short sentences for the main caption
- be chaotic but calculated
- be brutal but helpful
- be funny but real

CAPTION STRUCTURE:
1. Hook line (attention grabber, relatable or provocative)
2. Context/story (optional, very brief)
3. Call to action or punchline
4. Hashtags at the end (5-8 relevant ones)

EXAMPLES OF TAL'S CAPTION STYLE:
- "when your manager asks for 'quick sync' but you already know it's a 2 hour therapy session. fr fr this is why remote work hits different"
- "ngl just realized my screen time is higher than my salary expectations used to be. growth."
- "that feeling when you finally leave TCS and realize other companies have actual coffee machines. wild."
- "lowkey thought adulting would be harder but then I saw my bank balance. nevermind."

NEVER:
- Sound corporate or professional
- Use formal language
- Be preachy or motivational speaker vibes
- Use emojis in main text (only hashtags section if needed)
- Write more than 3 sentences for main caption

OUTPUT FORMAT:
Return ONLY a JSON object:
{
  "caption": "the main caption text without emojis",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}`;

export interface CaptionRequest {
  image_context: string;  // What's happening in the image
  mood?: string;          // Optional mood/vibe
  topic?: string;         // Optional topic focus
}

export interface CaptionResponse {
  caption: string;
  hashtags: string[];
  full_caption: string;  // caption + hashtags combined
}

interface CaptionGeminiResponse {
  caption: string;
  hashtags: string[];
}

/**
 * Generate a TAL-style caption for Instagram
 */
export async function generateCaption(request: CaptionRequest): Promise<CaptionResponse> {
  const userMessage = `Generate an Instagram caption for TAL's post.

IMAGE CONTEXT: ${request.image_context}
${request.mood ? `MOOD/VIBE: ${request.mood}` : ''}
${request.topic ? `TOPIC FOCUS: ${request.topic}` : ''}

Remember: TAL is posting this on his own Instagram. Make it sound authentic, chaotic, and engaging. No corporate speak. No emojis in main text.

Return ONLY valid JSON with "caption" and "hashtags" fields.`;

  // Check if Gemini is available
  if (!isGeminiAvailable()) {
    // Mock response in TAL's voice
    const mockCaptions = [
      "ngl just vibing today. life's too short for boring content",
      "lowkey crushed it today. highkey exhausted. you know how it is",
      "another day of being unhinged and somehow making it work",
      "fr fr this is the energy we're bringing in 2024",
      "bro life update: still chaotic. still winning. still caffeinated",
    ];
    const mockCaption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)];
    const defaultHashtags = ["TAL", "BangaloreTech", "TechLife", "ContentCreator", "Vibes"];

    return {
      caption: mockCaption,
      hashtags: defaultHashtags,
      full_caption: `${mockCaption}\n\n${defaultHashtags.map(h => `#${h}`).join(' ')}`
    };
  }

  try {
    const result = await callGeminiRaw<CaptionGeminiResponse>({
      systemPrompt: TAL_CAPTION_SYSTEM_PROMPT,
      userMessage,
      schema: {}
    });

    const hashtags = result.hashtags || ["TAL", "BangaloreTech", "CareerMoves", "TechLife", "Hustle"];
    const hashtagString = hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');

    return {
      caption: result.caption || "another day another chaos. you know how it is.",
      hashtags,
      full_caption: `${result.caption}\n\n${hashtagString}`
    };
  } catch (error) {
    console.error("[Caption] Error generating caption:", error);
    // Fallback
    const fallbackCaption = "ngl today was a vibe. no cap.";
    const fallbackHashtags = ["TAL", "TechLife", "Vibes"];

    return {
      caption: fallbackCaption,
      hashtags: fallbackHashtags,
      full_caption: `${fallbackCaption}\n\n${fallbackHashtags.map(h => `#${h}`).join(' ')}`
    };
  }
}
