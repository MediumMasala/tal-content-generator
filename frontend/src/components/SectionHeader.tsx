import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  className = '',
}) => {
  return (
    <motion.div
      className={`mb-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center gap-4">
        {/* Accent line */}
        <div className="w-8 h-px bg-gradient-to-r from-violet-500 to-transparent" />

        <h2 className="text-lg font-medium text-white tracking-wide">
          {title}
        </h2>
      </div>

      {subtitle && (
        <p className="mt-2 ml-12 text-sm text-white/40 font-light">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

export default SectionHeader;
