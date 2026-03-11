import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface AmbientBackgroundProps {
  intensity?: 'low' | 'medium' | 'high';
}

const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ intensity = 'medium' }) => {
  // Generate floating particles
  const particles = useMemo(() => {
    const count = intensity === 'high' ? 60 : intensity === 'medium' ? 40 : 20;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.5 + Math.random() * 2,
      duration: 20 + Math.random() * 25,
      delay: Math.random() * 15,
      color: Math.random() > 0.5 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(167, 139, 250, 0.3)',
    }));
  }, [intensity]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Deep base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 70% at 50% 0%, rgba(30, 27, 75, 0.4) 0%, transparent 50%),
            radial-gradient(ellipse 80% 50% at 80% 80%, rgba(55, 48, 163, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 20% 60%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
            linear-gradient(180deg, #08080a 0%, #0a0a0f 30%, #0c0c12 60%, #08080a 100%)
          `,
        }}
      />

      {/* Animated gradient blob - top right */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 800,
          height: 800,
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, rgba(79, 70, 229, 0.03) 40%, transparent 70%)',
          filter: 'blur(80px)',
          top: '-20%',
          right: '-10%',
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Animated gradient blob - bottom left */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 600,
          height: 600,
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.06) 0%, rgba(139, 92, 246, 0.02) 40%, transparent 70%)',
          filter: 'blur(60px)',
          bottom: '10%',
          left: '-10%',
        }}
        animate={{
          x: [0, -20, 0],
          y: [0, -30, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Center ambient glow (behind orb) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 700,
          height: 700,
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 60%)',
          filter: 'blur(100px)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        animate={{
          opacity: intensity === 'high' ? [0.5, 0.8, 0.5] : [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Floating particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: particle.color,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
          }}
          animate={{
            y: [0, -150, 0],
            x: [0, Math.random() * 50 - 25, 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle star field */}
      {Array.from({ length: 30 }, (_, i) => (
        <motion.div
          key={`star-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            width: 1,
            height: 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 2,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Very subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Edge vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(8, 8, 10, 0.5) 70%, rgba(8, 8, 10, 0.95) 100%)
          `,
        }}
      />

      {/* Top edge fade */}
      <div
        className="absolute top-0 left-0 right-0 h-32"
        style={{
          background: 'linear-gradient(180deg, rgba(8, 8, 10, 0.8) 0%, transparent 100%)',
        }}
      />

      {/* Noise texture overlay */}
      <div className="noise-overlay" />
    </div>
  );
};

export default AmbientBackground;
