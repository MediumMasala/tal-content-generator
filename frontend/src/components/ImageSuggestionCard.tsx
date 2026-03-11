import { motion } from 'framer-motion';
import { Image, Camera, Monitor, User, Building2, FileImage, XCircle } from 'lucide-react';

interface ImageSuggestionCardProps {
  title: string;
  rationale: string;
  type: 'portrait' | 'desk' | 'product' | 'office' | 'screenshot' | 'none' | 'abstract';
  index?: number;
  isRecommended?: boolean;
}

const iconMap = {
  portrait: User,
  desk: Camera,
  product: Monitor,
  office: Building2,
  screenshot: FileImage,
  none: XCircle,
  abstract: Image,
};

const ImageSuggestionCard: React.FC<ImageSuggestionCardProps> = ({
  title,
  rationale,
  type,
  index = 0,
  isRecommended = false,
}) => {
  const Icon = iconMap[type] || Image;

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
          ${isRecommended
            ? 'border-violet-500/30 bg-violet-500/5'
            : 'border-white/5 bg-void-light/30 hover:border-white/10'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Recommended badge */}
        {isRecommended && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-medium uppercase tracking-wider">
              Recommended
            </span>
          </div>
        )}

        {/* Thumbnail placeholder */}
        <div className="aspect-video relative bg-void-lighter/50 flex items-center justify-center overflow-hidden">
          {/* Abstract pattern background */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.2) 0%, transparent 30%),
                radial-gradient(circle at 80% 70%, rgba(124, 58, 237, 0.15) 0%, transparent 30%)
              `,
            }}
          />

          {/* Icon */}
          <motion.div
            className="relative z-10"
            animate={{
              y: [0, -3, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Icon className={`w-8 h-8 ${isRecommended ? 'text-violet-400' : 'text-white/20'}`} />
          </motion.div>

          {/* Hover overlay */}
          <motion.div
            className="absolute inset-0 bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>

        {/* Content */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-white/90 mb-1">
            {title}
          </h4>
          <p className="text-xs text-white/40 font-light line-clamp-2">
            {rationale}
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-px
            ${isRecommended
              ? 'bg-gradient-to-r from-transparent via-violet-500/50 to-transparent'
              : 'bg-gradient-to-r from-transparent via-white/5 to-transparent'
            }
          `}
        />
      </motion.div>
    </motion.div>
  );
};

export default ImageSuggestionCard;
