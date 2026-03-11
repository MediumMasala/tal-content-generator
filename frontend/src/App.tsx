import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Orb,
  AmbientBackground,
  AudioControl,
  InputPanel,
  ThinkingState,
  SectionHeader,
  MainRecommendationCard,
  RecommendationTypeCard,
  PersonalityCard,
} from './components';

// App state type
type AppState = 'idle' | 'thinking' | 'completed';

// API response type
interface GenerationResult {
  success: boolean;
  profileOnlyMode?: boolean; // true if user had zero posts
  personName: string;
  currentRole: string | null;
  currentCompany: string | null;
  username: string;
  writingStyleAvailable?: boolean;
  postCount: number;
  originalPostCount: number;
  averageWordCount: number | null;
  personality: {
    traits: string[];
    values: string[];
    communicationStyle: string | { inference: string; evidence: string; confidence: string } | null;
    professionalIdentity: string | null;
  } | null;
  knowledgeGraph: {
    industries: string[];
    technologies: string[];
    topics: string[];
  } | null;
  writingStyle: {
    voiceSummary: string | null;
    toneAttributes: string[];
    formattingPatterns: {
      shortLines?: boolean;
      spacedParagraphs?: boolean;
      emojiUsage?: string;
      otherHabits?: string[];
    } | null;
  } | null;
  // Original post (without viral CSV optimization)
  originalPost: {
    content: string;
    altContent: string;
  };
  // Recommended posts (with viral CSV optimization)
  recommendedPosts: Array<{
    type: string;
    description: string;
    content: string;
  }>;
  imageSuggestions: Array<{
    title: string;
    rationale: string;
    type: 'portrait' | 'desk' | 'product' | 'office' | 'screenshot' | 'none' | 'abstract';
    isRecommended: boolean;
  }>;
  timing?: {
    extractionMs: number;
    personalityMs: number;
    generationMs: number;
    totalMs: number;
  };
  personalityNotes?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Handle the analysis
  const handleAnalyze = async (url: string) => {
    console.log('Analyzing:', url);
    setAppState('thinking');
    setCurrentPhase(0);
    setError(null);

    try {
      // Start progress simulation while waiting for API
      const progressInterval = setInterval(() => {
        setCurrentPhase((prev) => {
          if (prev < 2) return prev + 1;
          return prev;
        });
      }, 30000); // Update phase every 30 seconds

      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedinUrl: url }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      const data: GenerationResult = await response.json();
      setResults(data);
      setAppState('completed');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAppState('idle');
    }
  };

  // Regenerate function - uses cached profile, generates new content
  const handleRegenerate = async () => {
    if (!results?.username) return;

    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: results.username,
          regenerate: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate content');
      }

      const data: GenerationResult = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Reset function
  const handleReset = () => {
    setAppState('idle');
    setResults(null);
    setCurrentPhase(0);
    setError(null);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background */}
      <AmbientBackground intensity={appState === 'thinking' ? 'high' : 'medium'} />

      {/* Audio control */}
      <AudioControl />

      {/* Main content */}
      <main className="relative z-10">
        {/* Hero section with Orb */}
        <section
          className={`
            relative flex flex-col items-center justify-center
            transition-all duration-1000 ease-out
            ${appState === 'completed' ? 'min-h-[40vh] pt-16' : 'min-h-screen'}
          `}
        >
          {/* Logo / Brand */}
          <motion.div
            className="absolute top-8 left-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <img
              src="/tal-logo.png"
              alt="Tal"
              className="h-8 w-auto"
            />
          </motion.div>

          {/* Back/Reset button */}
          <AnimatePresence>
            {(appState === 'thinking' || appState === 'completed') && (
              <motion.button
                className="absolute top-8 right-8 px-4 py-2 rounded-lg glass border border-white/10 text-sm text-white/60 hover:text-white/90 hover:border-white/20 transition-all flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleReset}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                {appState === 'completed' ? 'New Analysis' : 'Back'}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Orb container */}
          <motion.div
            className="relative"
            animate={{
              y: appState === 'completed' ? -30 : 0,
              scale: appState === 'completed' ? 0.7 : 1,
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <Orb state={appState} />
          </motion.div>

          {/* Thinking state phrases */}
          <ThinkingState
            isActive={appState === 'thinking'}
            currentPhase={currentPhase}
            totalPhases={3}
          />

          {/* Error message */}
          <AnimatePresence>
            {error && appState === 'idle' && (
              <motion.div
                className="absolute bottom-[18%] w-full max-w-md mx-auto px-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div className="glass rounded-lg px-4 py-3 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input panel - only in idle state */}
          <AnimatePresence>
            {appState === 'idle' && (
              <motion.div
                className="absolute bottom-[8%] w-full px-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5 }}
              >
                <InputPanel
                  onSubmit={handleAnalyze}
                  isLoading={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Profile info when completed */}
          <AnimatePresence>
            {appState === 'completed' && results && (
              <motion.div
                className="mt-6 text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-white/40 text-sm font-light">
                  Content generated for
                </p>
                <p className="text-white/90 text-lg font-medium mt-1">
                  {results.personName}
                </p>
                {(results.currentRole || results.currentCompany) && (
                  <p className="text-white/50 text-sm mt-1">
                    {results.currentRole}{results.currentRole && results.currentCompany ? ' at ' : ''}{results.currentCompany}
                  </p>
                )}
                {/* Social proof stats - only show if there are original posts */}
                {results.originalPostCount > 0 && results.averageWordCount && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10">
                      <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-white/60 text-xs font-medium">{results.originalPostCount} posts</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10">
                      <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-white/60 text-xs font-medium">~{results.averageWordCount} words avg</span>
                    </div>
                  </div>
                )}
                {results.timing && (
                  <p className="text-white/30 text-xs mt-2">
                    Generated in {Math.round(results.timing.totalMs / 1000)}s
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Results section */}
        <AnimatePresence>
          {appState === 'completed' && results && (
            <motion.section
              className="relative px-6 pb-24 max-w-4xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {/* Personality Profile */}
              <div className="mb-12">
                <SectionHeader
                  title="Personality Profile"
                  subtitle={results.profileOnlyMode
                    ? "Analysis based on profile data (no posts available)"
                    : `Analysis based on ${results.postCount} LinkedIn posts`}
                />
                <PersonalityCard
                  postCount={results.postCount}
                  personality={results.personality}
                  knowledgeGraph={results.knowledgeGraph}
                  writingStyle={results.writingStyle}
                />
              </div>

              {/* Version 1: Original Generated Post */}
              <div className="mb-8">
                <SectionHeader
                  title="Version 1: Generated Post"
                  subtitle="Original content in their authentic voice"
                />
                <MainRecommendationCard
                  content={results.originalPost.content}
                  hookType="Original"
                  onCopy={() => navigator.clipboard.writeText(results.originalPost.content)}
                  onRegenerate={handleRegenerate}
                  isRegenerating={isRegenerating}
                />
              </div>

              {/* Version 2: Alternate Version */}
              {results.originalPost.altContent && (
                <div className="mb-8">
                  <SectionHeader
                    title="Version 2: Alternate Angle"
                    subtitle="Different perspective, same authentic voice"
                  />
                  <MainRecommendationCard
                    content={results.originalPost.altContent}
                    hookType="Alternate"
                    onCopy={() => navigator.clipboard.writeText(results.originalPost.altContent)}
                    onRegenerate={handleRegenerate}
                    isRegenerating={isRegenerating}
                  />
                </div>
              )}

              {/* Version 3: LinkedIn-Friendly */}
              {results.recommendedPosts && results.recommendedPosts.length > 0 && (
                <div className="mb-12">
                  <SectionHeader
                    title="Version 3: LinkedIn-Friendly"
                    subtitle="Optimized for engagement using top-performing post patterns"
                  />
                  <MainRecommendationCard
                    content={results.recommendedPosts[0]?.content || ''}
                    hookType="LinkedIn-Optimized"
                    onCopy={() => navigator.clipboard.writeText(results.recommendedPosts[0]?.content || '')}
                    onRegenerate={handleRegenerate}
                    isRegenerating={isRegenerating}
                  />
                  {/* Show second optimized version as alternative */}
                  {results.recommendedPosts[1] && (
                    <div className="mt-4">
                      <RecommendationTypeCard
                        type="Alternative LinkedIn-Friendly"
                        description={results.recommendedPosts[1].description}
                        preview={results.recommendedPosts[1].content?.substring(0, 100) + '...' || ''}
                        fullContent={results.recommendedPosts[1].content || ''}
                        index={1}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Personality notes */}
              {results.personalityNotes && (
                <motion.div
                  className="mt-12 p-6 glass rounded-xl border border-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <h3 className="text-sm font-medium text-white/60 mb-3 uppercase tracking-wider">
                    Personality Analysis Notes
                  </h3>
                  <p className="text-white/40 text-sm font-light leading-relaxed">
                    {results.personalityNotes}
                  </p>
                </motion.div>
              )}

              {/* Footer attribution */}
              <motion.div
                className="mt-16 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <p className="text-white/20 text-xs font-light tracking-wider">
                  Powered by Tal Intelligence
                </p>
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
