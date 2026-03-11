import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface RecommendationTypeCardProps {
  type: string;
  description: string;
  preview: string;
  fullContent: string;
  index?: number;
}

const RecommendationTypeCard: React.FC<RecommendationTypeCardProps> = ({
  type,
  description,
  preview,
  fullContent,
  index = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <motion.div
        className={`
          relative overflow-hidden rounded-xl cursor-pointer
          border transition-all duration-300
          ${isExpanded
            ? 'border-violet-500/30 bg-void-lighter/50'
            : 'border-white/5 bg-void-light/30 hover:border-white/10 hover:bg-void-lighter/30'
          }
        `}
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: isExpanded ? 1 : 1.01 }}
      >
        {/* Header */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Type badge */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">
                  {type}
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="w-3 h-3 text-white/30" />
                </motion.div>
              </div>

              {/* Description */}
              <p className="text-sm text-white/50 font-light mb-3">
                {description}
              </p>

              {/* Preview */}
              <p className="text-sm text-white/70 line-clamp-2 font-light">
                {preview}
              </p>
            </div>

            {/* Copy button */}
            <motion.button
              onClick={handleCopy}
              className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-white/40" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-0">
                <div className="pt-4 border-t border-white/5">
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap font-light">
                    {fullContent}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-4">
                    <motion.button
                      className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Use this version
                    </motion.button>

                    <span className="text-xs text-white/30">
                      {fullContent.split(/\s+/).length} words
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover glow effect */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          style={{
            background: 'radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(139, 92, 246, 0.06), transparent 40%)',
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default RecommendationTypeCard;
