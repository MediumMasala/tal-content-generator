import { motion } from 'framer-motion';
import { Copy, RefreshCw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface MainRecommendationCardProps {
  content: string;
  hookType?: string;
  onCopy?: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const MainRecommendationCard: React.FC<MainRecommendationCardProps> = ({
  content,
  hookType = 'Recommended',
  onCopy,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Glow effect */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-50"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, transparent 50%, rgba(124, 58, 237, 0.2) 100%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Card content */}
      <div className="relative glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            {/* Indicator */}
            <motion.div
              className="w-2 h-2 rounded-full bg-violet-400"
              animate={{
                opacity: [0.5, 1, 0.5],
                boxShadow: [
                  '0 0 8px rgba(167, 139, 250, 0.3)',
                  '0 0 16px rgba(167, 139, 250, 0.6)',
                  '0 0 8px rgba(167, 139, 250, 0.3)',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <span className="text-sm font-medium text-white/80 tracking-wide uppercase">
              {hookType}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
              )}
            </motion.button>

            <motion.button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors group disabled:opacity-30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={isRegenerating ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isRegenerating ? Infinity : 0, ease: 'linear' }}
              >
                <RefreshCw className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
              </motion.div>
            </motion.button>

            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={false}
          animate={{
            height: isExpanded ? 'auto' : 0,
            opacity: isExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="p-6">
            <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap font-light">
              {content}
            </p>
          </div>
        </motion.div>

        {/* Footer with word count */}
        <motion.div
          className="px-6 py-3 border-t border-white/5 flex items-center justify-between"
          animate={{
            opacity: isExpanded ? 1 : 0,
          }}
        >
          <span className="text-xs text-white/30 font-light">
            {content.split(/\s+/).length} words
          </span>

          <motion.button
            className="px-4 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Use this post
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MainRecommendationCard;
