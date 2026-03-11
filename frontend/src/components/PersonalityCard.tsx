import { motion } from 'framer-motion';

interface PersonalityCardProps {
  postCount: number;
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
}

export function PersonalityCard({
  postCount,
  personality,
  knowledgeGraph,
  writingStyle,
}: PersonalityCardProps) {
  return (
    <motion.div
      className="glass rounded-2xl border border-white/10 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header with post count */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
          Personality Profile
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Based on</span>
          <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-medium">
            {postCount} posts
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Personality Traits & Values */}
        {personality && (
          <div className="space-y-4">
            {/* Traits */}
            {personality.traits.length > 0 && (
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Traits
                </label>
                <div className="flex flex-wrap gap-2">
                  {personality.traits.map((trait, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full bg-white/5 text-white/70 text-sm border border-white/10"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Values */}
            {personality.values.length > 0 && (
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Values
                </label>
                <div className="flex flex-wrap gap-2">
                  {personality.values.map((value, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full bg-violet-500/10 text-violet-300 text-sm border border-violet-500/20"
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Communication Style */}
            {personality.communicationStyle && (
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Communication Style
                </label>
                <p className="text-white/60 text-sm">
                  {typeof personality.communicationStyle === 'string'
                    ? personality.communicationStyle
                    : personality.communicationStyle.inference}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Knowledge Graph */}
        {knowledgeGraph && (
          <div className="pt-4 border-t border-white/5 space-y-4">
            <label className="text-xs text-white/40 uppercase tracking-wider block">
              Knowledge Graph
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Industries */}
              {knowledgeGraph.industries.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-white/30">Industries</span>
                  <div className="flex flex-wrap gap-1">
                    {knowledgeGraph.industries.slice(0, 5).map((industry, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 text-xs"
                      >
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Technologies */}
              {knowledgeGraph.technologies.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-white/30">Technologies</span>
                  <div className="flex flex-wrap gap-1">
                    {knowledgeGraph.technologies.slice(0, 5).map((tech, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-xs"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              {knowledgeGraph.topics.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-white/30">Topics</span>
                  <div className="flex flex-wrap gap-1">
                    {knowledgeGraph.topics.slice(0, 5).map((topic, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Writing Style */}
        {writingStyle && (
          <div className="pt-4 border-t border-white/5 space-y-4">
            <label className="text-xs text-white/40 uppercase tracking-wider block">
              Writing Style
            </label>

            {/* Voice Summary */}
            {writingStyle.voiceSummary && (
              <p className="text-white/60 text-sm italic">
                "{writingStyle.voiceSummary}"
              </p>
            )}

            {/* Tone Attributes */}
            {writingStyle.toneAttributes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {writingStyle.toneAttributes.map((attr, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 rounded-full bg-white/5 text-white/50 text-xs"
                  >
                    {attr}
                  </span>
                ))}
              </div>
            )}

            {/* Formatting Patterns */}
            {writingStyle.formattingPatterns && (
              <div className="space-y-2">
                <div className="flex gap-4 text-xs text-white/40">
                  <span className={writingStyle.formattingPatterns.shortLines ? 'text-white/60' : 'opacity-50'}>
                    {writingStyle.formattingPatterns.shortLines ? '✓' : '✗'} Short Lines
                  </span>
                  <span className={writingStyle.formattingPatterns.spacedParagraphs ? 'text-white/60' : 'opacity-50'}>
                    {writingStyle.formattingPatterns.spacedParagraphs ? '✓' : '✗'} Spaced Paragraphs
                  </span>
                  {writingStyle.formattingPatterns.emojiUsage && (
                    <span className="text-white/60">
                      Emojis: {writingStyle.formattingPatterns.emojiUsage}
                    </span>
                  )}
                </div>
                {writingStyle.formattingPatterns.otherHabits && writingStyle.formattingPatterns.otherHabits.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {writingStyle.formattingPatterns.otherHabits.map((habit, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-white/40 text-xs">
                        {habit}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No data fallback */}
        {!personality && !knowledgeGraph && !writingStyle && (
          <div className="text-center py-8 text-white/30 text-sm">
            No personality data available
          </div>
        )}
      </div>
    </motion.div>
  );
}
