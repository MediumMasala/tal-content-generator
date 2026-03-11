import { motion, AnimatePresence } from 'framer-motion';
import { useMemo } from 'react';

interface OrbProps {
  state: 'idle' | 'thinking' | 'completed';
}

const Orb: React.FC<OrbProps> = ({ state }) => {
  // Generate particles for ambient effect
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      angle: (i / 40) * 360,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 3,
      distance: 100 + Math.random() * 80,
      size: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, []);

  // Floating specks inside the orb
  const innerSpecks = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: -30 + Math.random() * 60,
      y: -30 + Math.random() * 60,
      size: 1 + Math.random() * 1.5,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 2,
    }));
  }, []);

  const isThinking = state === 'thinking';
  const isCompleted = state === 'completed';

  return (
    <motion.div
      className="relative flex items-center justify-center"
      animate={{
        scale: isCompleted ? 0.75 : 1,
        y: isCompleted ? -40 : 0,
      }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      {/* Outermost ambient glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 500,
          height: 500,
          background: 'radial-gradient(circle, rgba(120, 119, 198, 0.12) 0%, rgba(99, 102, 241, 0.05) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{
          scale: isThinking ? [1, 1.15, 1] : [1, 1.05, 1],
          opacity: isThinking ? [0.6, 0.9, 0.6] : [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: isThinking ? 2 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Secondary halo ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 350,
          height: 350,
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
          filter: 'blur(30px)',
        }}
        animate={{
          scale: isThinking ? [1, 1.2, 1] : [1, 1.1, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          scale: {
            duration: isThinking ? 1.5 : 3,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          rotate: {
            duration: isThinking ? 10 : 20,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      />

      {/* Expanding halo rings during thinking */}
      <AnimatePresence>
        {isThinking && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={`ring-${i}`}
                className="absolute rounded-full"
                style={{
                  width: 180,
                  height: 180,
                  border: '1px solid',
                  borderColor: 'rgba(139, 92, 246, 0.3)',
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 2.5, 3],
                  opacity: [0.5, 0.2, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.75,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Particle field */}
      <div className="absolute" style={{ width: 300, height: 300 }}>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              left: '50%',
              top: '50%',
              background: `rgba(167, 139, 250, ${particle.opacity})`,
              boxShadow: '0 0 4px rgba(167, 139, 250, 0.5)',
            }}
            animate={{
              x: [0, Math.cos((particle.angle * Math.PI) / 180) * particle.distance],
              y: [0, Math.sin((particle.angle * Math.PI) / 180) * particle.distance],
              opacity: isThinking ? [0, 0.8, 0] : [0, 0.4, 0],
              scale: isThinking ? [0, 1.5, 0] : [0, 1, 0],
            }}
            transition={{
              duration: isThinking ? particle.duration * 0.5 : particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* Inner core glow (breathing) */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 220,
          height: 220,
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)',
          filter: 'blur(25px)',
        }}
        animate={{
          scale: isThinking ? [1, 1.3, 1] : [1, 1.15, 1],
          opacity: isThinking ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: isThinking ? 1.2 : 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main sphere */}
      <motion.div
        className="relative rounded-full overflow-hidden"
        style={{
          width: 160,
          height: 160,
          background: `
            radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.25) 0%, transparent 40%),
            radial-gradient(circle at 70% 80%, rgba(99, 102, 241, 0.3) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.9) 0%, rgba(99, 102, 241, 0.8) 30%, rgba(79, 70, 229, 0.7) 60%, rgba(55, 48, 163, 0.6) 100%)
          `,
          boxShadow: isThinking
            ? `
              0 0 60px rgba(139, 92, 246, 0.5),
              0 0 100px rgba(99, 102, 241, 0.3),
              inset 0 0 60px rgba(167, 139, 250, 0.3),
              inset -20px -20px 40px rgba(55, 48, 163, 0.4)
            `
            : `
              0 0 40px rgba(139, 92, 246, 0.3),
              0 0 80px rgba(99, 102, 241, 0.2),
              inset 0 0 40px rgba(167, 139, 250, 0.2),
              inset -20px -20px 30px rgba(55, 48, 163, 0.3)
            `,
        }}
        animate={{
          scale: isThinking ? [1, 1.05, 1] : 1,
        }}
        transition={{
          duration: 1.5,
          repeat: isThinking ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Glass highlight */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '50%',
            height: '35%',
            top: '10%',
            left: '15%',
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
            filter: 'blur(8px)',
            borderRadius: '50%',
          }}
          animate={{
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Inner floating specks */}
        {innerSpecks.map((speck) => (
          <motion.div
            key={`speck-${speck.id}`}
            className="absolute rounded-full bg-white/40"
            style={{
              width: speck.size,
              height: speck.size,
              left: '50%',
              top: '50%',
              filter: 'blur(0.5px)',
            }}
            animate={{
              x: [speck.x, speck.x + 10, speck.x],
              y: [speck.y, speck.y - 15, speck.y],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: speck.duration,
              repeat: Infinity,
              delay: speck.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Surface shimmer rotation */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255, 255, 255, 0.15) 50%, transparent 70%)',
          }}
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: isThinking ? 4 : 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Color shift overlay */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(45deg, rgba(236, 72, 153, 0.1) 0%, transparent 50%, rgba(59, 130, 246, 0.1) 100%)',
            mixBlendMode: 'overlay',
          }}
          animate={{
            rotate: -360,
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>

      {/* Orbital ring 1 */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          width: 220,
          height: 220,
          borderColor: 'rgba(139, 92, 246, 0.2)',
          borderWidth: 1,
          transform: 'rotateX(75deg)',
        }}
        animate={{
          rotate: 360,
          borderColor: isThinking
            ? ['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.5)', 'rgba(139, 92, 246, 0.2)']
            : 'rgba(139, 92, 246, 0.2)',
        }}
        transition={{
          rotate: {
            duration: isThinking ? 5 : 15,
            repeat: Infinity,
            ease: 'linear',
          },
          borderColor: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }}
      >
        {/* Orbital dot */}
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-violet-400"
          style={{
            top: -4,
            left: '50%',
            marginLeft: -4,
            boxShadow: '0 0 10px rgba(167, 139, 250, 0.8)',
          }}
        />
      </motion.div>

      {/* Orbital ring 2 */}
      <motion.div
        className="absolute rounded-full border"
        style={{
          width: 260,
          height: 260,
          borderColor: 'rgba(99, 102, 241, 0.15)',
          borderWidth: 1,
          transform: 'rotateX(75deg) rotateY(30deg)',
        }}
        animate={{
          rotate: -360,
        }}
        transition={{
          duration: isThinking ? 8 : 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Energy burst during thinking */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            className="absolute rounded-full"
            style={{
              width: 180,
              height: 180,
              background: 'radial-gradient(circle, rgba(167, 139, 250, 0.3) 0%, transparent 50%)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Orb;
