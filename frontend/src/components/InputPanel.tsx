import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface InputPanelProps {
  onSubmit: (url: string, userTopic?: string) => void;
  isLoading: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');
  const [userTopic, setUserTopic] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isTopicFocused, setIsTopicFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isLoading) {
      onSubmit(url.trim(), userTopic.trim() || undefined);
    }
  };

  // Topic suggestions
  const topicSuggestions = [
    'salary insights',
    'brutal honesty',
    'career growth',
    'job matching',
  ];

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
    >
      <form onSubmit={handleSubmit} className="relative space-y-4">
        {/* LinkedIn URL Input */}
        <motion.div
          className={`
            relative overflow-hidden rounded-2xl
            transition-all duration-500
            ${isFocused ? 'shadow-glow-lg' : 'shadow-lg'}
          `}
          animate={{
            boxShadow: isFocused
              ? '0 0 80px rgba(139, 92, 246, 0.25), 0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Gradient border */}
          <div
            className={`
              absolute inset-0 rounded-2xl p-[1px]
              transition-opacity duration-500
              ${isFocused ? 'opacity-100' : 'opacity-40'}
            `}
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.5) 0%, rgba(124, 58, 237, 0.3) 50%, rgba(139, 92, 246, 0.5) 100%)',
            }}
          />

          {/* Inner container */}
          <div className="relative glass rounded-2xl p-1.5">
            <div className="flex items-center gap-3 px-5 py-4 bg-void-light/50 rounded-xl">
              {/* Icon */}
              <motion.div
                animate={{
                  rotate: isLoading ? 360 : 0,
                }}
                transition={{
                  duration: 2,
                  repeat: isLoading ? Infinity : 0,
                  ease: 'linear',
                }}
              >
                <Sparkles className="w-5 h-5 text-violet-400/70" />
              </motion.div>

              {/* Input */}
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Paste LinkedIn profile URL..."
                disabled={isLoading}
                className={`
                  flex-1 bg-transparent text-white placeholder-white/30
                  text-base font-light tracking-wide
                  focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              />

              {/* Submit button */}
              <motion.button
                type="submit"
                disabled={!url.trim() || isLoading}
                className={`
                  relative px-6 py-2.5 rounded-xl font-medium text-sm
                  transition-all duration-300
                  disabled:opacity-30 disabled:cursor-not-allowed
                  ${url.trim() && !isLoading
                    ? 'bg-violet-500 text-white hover:bg-violet-400'
                    : 'bg-white/5 text-white/40'
                  }
                `}
                whileHover={url.trim() && !isLoading ? { scale: 1.02 } : {}}
                whileTap={url.trim() && !isLoading ? { scale: 0.98 } : {}}
              >
                <span className="flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <span>Analyzing</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* User Topic Input (Optional) */}
        <motion.div
          className={`
            relative overflow-hidden rounded-xl
            transition-all duration-500
          `}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div
            className={`
              absolute inset-0 rounded-xl p-[1px]
              transition-opacity duration-500
              ${isTopicFocused ? 'opacity-60' : 'opacity-20'}
            `}
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(124, 58, 237, 0.2) 100%)',
            }}
          />

          <div className="relative glass rounded-xl p-1">
            <div className="flex items-center gap-3 px-4 py-3 bg-void-light/30 rounded-lg">
              <MessageSquare className="w-4 h-4 text-violet-400/50" />
              <input
                type="text"
                value={userTopic}
                onChange={(e) => setUserTopic(e.target.value)}
                onFocus={() => setIsTopicFocused(true)}
                onBlur={() => setIsTopicFocused(false)}
                placeholder="Topic focus (optional): e.g., salary, career growth, brutal honesty..."
                disabled={isLoading}
                className={`
                  flex-1 bg-transparent text-white placeholder-white/25
                  text-sm font-light tracking-wide
                  focus:outline-none
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              />
            </div>
          </div>
        </motion.div>

        {/* Topic suggestion chips */}
        <motion.div
          className="flex flex-wrap justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {topicSuggestions.map((topic) => (
            <motion.button
              key={topic}
              type="button"
              onClick={() => setUserTopic(topic)}
              disabled={isLoading}
              className={`
                px-3 py-1.5 rounded-full text-xs font-light
                transition-all duration-200
                border border-white/10
                ${userTopic === topic
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                  : 'bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
                }
                disabled:opacity-30 disabled:cursor-not-allowed
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {topic}
            </motion.button>
          ))}
        </motion.div>

        {/* Helper text */}
        <motion.p
          className="mt-4 text-center text-sm text-white/30 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Enter a public LinkedIn profile to generate personalized content
        </motion.p>
      </form>
    </motion.div>
  );
};

export default InputPanel;
