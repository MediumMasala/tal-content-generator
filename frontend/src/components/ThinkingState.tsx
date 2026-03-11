import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface ThinkingStateProps {
  isActive: boolean;
  currentPhase?: number;
  totalPhases?: number;
}

const THINKING_PHRASES = [
  'analyzing public writing signals',
  'understanding tone and restraint',
  'mapping communication patterns',
  'analyzing profile intent',
  'identifying personality traits',
  'checking writing rhythm',
  'understanding audience fit',
  'analyzing professional positioning',
  'building recommendation graph',
  'inferring post style preferences',
  'evaluating directness signals',
  'analyzing attention patterns',
  'identifying communication cadence',
  'understanding working style',
  'interpreting behavioral signals',
  'calibrating voice parameters',
  'synthesizing content strategy',
  'optimizing for authenticity',
];

const ThinkingState: React.FC<ThinkingStateProps> = ({
  isActive,
  currentPhase = 0,
  totalPhases = 3,
}) => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayedPhrase, setDisplayedPhrase] = useState(THINKING_PHRASES[0]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    setDisplayedPhrase(THINKING_PHRASES[currentPhraseIndex]);
  }, [currentPhraseIndex]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="absolute inset-x-0 flex flex-col items-center justify-center"
          style={{ top: '55%' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Thinking phrase */}
          <motion.div
            className="relative h-8 flex items-center justify-center overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={displayedPhrase}
                className="text-white/50 text-sm font-light tracking-widest uppercase"
                initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                transition={{ duration: 0.5 }}
              >
                {displayedPhrase}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Progress indicator */}
          <motion.div
            className="mt-8 flex items-center gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Phase dots */}
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPhases }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`
                    w-1.5 h-1.5 rounded-full
                    ${i <= currentPhase ? 'bg-violet-400' : 'bg-white/20'}
                  `}
                  animate={
                    i === currentPhase
                      ? {
                          scale: [1, 1.5, 1],
                          opacity: [0.7, 1, 0.7],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Phase label */}
            <motion.span
              className="text-white/30 text-xs font-light tracking-wider"
              key={currentPhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {currentPhase === 0 && 'extracting profile'}
              {currentPhase === 1 && 'building personality'}
              {currentPhase === 2 && 'generating content'}
            </motion.span>
          </motion.div>

          {/* Ambient lines animation */}
          <div className="absolute w-full h-px top-0 overflow-hidden opacity-20">
            <motion.div
              className="h-full bg-gradient-to-r from-transparent via-violet-400 to-transparent"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ width: '50%' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ThinkingState;
