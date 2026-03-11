import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface AudioControlProps {
  className?: string;
}

const AudioControl: React.FC<AudioControlProps> = ({ className = '' }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Create ambient sound using Web Audio API
  const createAmbientSound = () => {
    if (audioContextRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    const masterGain = audioContext.createGain();
    masterGain.gain.value = 0.03; // Very quiet
    masterGain.connect(audioContext.destination);
    gainNodeRef.current = masterGain;

    // Create multiple oscillators for ambient drone
    const frequencies = [55, 82.5, 110, 165]; // Low ambient frequencies

    frequencies.forEach((freq) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = freq;

      // Add subtle modulation
      const lfo = audioContext.createOscillator();
      const lfoGain = audioContext.createGain();
      lfo.frequency.value = 0.1 + Math.random() * 0.2;
      lfoGain.gain.value = freq * 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start();

      gainNode.gain.value = 0.3 + Math.random() * 0.2;
      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      oscillator.start();
      oscillatorsRef.current.push(oscillator);
    });

    setIsPlaying(true);
  };

  const toggleMute = () => {
    if (!audioContextRef.current) {
      createAmbientSound();
      setIsMuted(false);
      setShowPrompt(false);
    } else {
      if (isMuted) {
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.linearRampToValueAtTime(0.03, audioContextRef.current.currentTime + 0.5);
        }
      } else {
        if (gainNodeRef.current && audioContextRef.current) {
          gainNodeRef.current.gain.linearRampToValueAtTime(0, audioContextRef.current.currentTime + 0.5);
        }
      }
      setIsMuted(!isMuted);
    }
  };

  // Try autoplay on mount
  useEffect(() => {
    const tryAutoplay = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          setShowPrompt(true);
          audioContext.close();
        } else {
          // Autoplay is allowed
          audioContextRef.current = audioContext;
          createAmbientSound();
          setIsMuted(false);
        }
      } catch {
        setShowPrompt(true);
      }
    };

    const timer = setTimeout(tryAutoplay, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      oscillatorsRef.current.forEach((osc) => {
        try {
          osc.stop();
        } catch {
          // Ignore errors
        }
      });
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <AnimatePresence>
        {showPrompt && !isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full right-0 mb-3 whitespace-nowrap"
          >
            <div className="glass rounded-lg px-4 py-2 text-xs text-white/60 border border-white/5">
              Tap to enable ambient sound
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={toggleMute}
        className="group relative w-12 h-12 rounded-full glass border border-white/10 flex items-center justify-center transition-all duration-300 hover:border-violet-500/30 hover:shadow-glow"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          initial={false}
          animate={{ opacity: isMuted ? 0.4 : 1 }}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
          ) : (
            <Volume2 className="w-5 h-5 text-violet-400 group-hover:text-violet-300 transition-colors" />
          )}
        </motion.div>

        {/* Active indicator */}
        {!isMuted && isPlaying && (
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-violet-500"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </motion.button>
    </div>
  );
};

export default AudioControl;
