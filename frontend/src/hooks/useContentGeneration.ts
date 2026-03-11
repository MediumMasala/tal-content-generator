import { useState, useCallback } from 'react';

export interface GenerationResult {
  mainPost: {
    content: string;
    hookType: string;
  };
  alternateVersions: Array<{
    type: string;
    description: string;
    preview: string;
    fullContent: string;
  }>;
  imageSuggestions: Array<{
    title: string;
    rationale: string;
    type: 'portrait' | 'desk' | 'product' | 'office' | 'screenshot' | 'none' | 'abstract';
    isRecommended: boolean;
  }>;
  personName: string;
  username: string;
}

export interface GenerationProgress {
  phase: number;
  totalPhases: number;
  message: string;
}

interface UseContentGenerationReturn {
  isLoading: boolean;
  progress: GenerationProgress | null;
  result: GenerationResult | null;
  error: string | null;
  generate: (linkedinUrl: string) => Promise<void>;
  reset: () => void;
}

export function useContentGeneration(): UseContentGenerationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (linkedinUrl: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Phase 1: Extract LinkedIn profile
      setProgress({ phase: 0, totalPhases: 3, message: 'Extracting profile data' });

      // In production, this would call the actual backend API:
      // const response = await fetch(`${API_BASE_URL}/api/generate`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ linkedinUrl }),
      // });

      // For now, simulate the phases with mock data
      await simulatePhase(2000);
      setProgress({ phase: 1, totalPhases: 3, message: 'Building personality profile' });

      await simulatePhase(2500);
      setProgress({ phase: 2, totalPhases: 3, message: 'Generating content' });

      await simulatePhase(2000);

      // Mock result - in production, parse from API response
      const mockResult: GenerationResult = {
        mainPost: {
          content: `most career advice is designed to waste your time.

it makes you feel productive, not get you a better job.

spent some time with Tal recently. it's the opposite.

like a brutally honest friend who tells you:

"you're not building the next chatgpt, you're just the guy who cleans the data."

harsh, but useful.`,
          hookType: 'Problem-Agitate-Solution',
        },
        alternateVersions: [
          {
            type: 'Before/After',
            description: 'Contrasts two states to show transformation',
            preview: 'job search before: 100 "maybes". job search after: 1 "hell yes"...',
            fullContent: `job search before:
100 "maybes"

job search after:
1 "hell yes"

a friend at grapevine showed me what they're building. their whole model is built on this idea.

most products default to volume because it feels like value.
but the real value is in the filter.

it's a hard design choice, but a good one.`,
          },
          {
            type: 'Analogy',
            description: 'Uses comparison to make concept relatable',
            preview: 'this new career agent is like a brutally honest friend...',
            fullContent: `this new career agent is like a brutally honest friend.

the kind who doesn't soften the blow.

i was testing a feature in tal that checks if you're underpaid. the response was basically:

"bro. you are being criminally underpaid."

there's something useful about a tool that isn't trying to be polite.
it's just trying to be right.`,
          },
        ],
        imageSuggestions: [
          {
            title: 'Minimal Portrait',
            rationale: 'Clean headshot reinforces personal credibility',
            type: 'portrait',
            isRecommended: true,
          },
          {
            title: 'Product Screenshot',
            rationale: 'Show the interface to give visual reference',
            type: 'screenshot',
            isRecommended: false,
          },
          {
            title: 'No Image',
            rationale: 'Text-only posts often perform well',
            type: 'none',
            isRecommended: false,
          },
        ],
        personName: extractNameFromUrl(linkedinUrl),
        username: extractUsernameFromUrl(linkedinUrl),
      };

      setResult(mockResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    isLoading,
    progress,
    result,
    error,
    generate,
    reset,
  };
}

// Helper functions
function simulatePhase(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUsernameFromUrl(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  return match ? match[1] : 'unknown-user';
}

function extractNameFromUrl(url: string): string {
  const username = extractUsernameFromUrl(url);
  return username
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default useContentGeneration;
