import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@chrisasstanina/ui';
import type { WorkdayPhase } from '@chrisasstanina/salary-flow-core';

const MAX_PARTICLES = 20;

interface Particle {
  id: number;
  x: number;
  delay: number;
  size: number;
}

interface MoneyJarVisualizationProps {
  progress: number;
  phase: WorkdayPhase;
  className?: string;
}

export function MoneyJarVisualization({ progress, phase, className }: MoneyJarVisualizationProps) {
  const prefersReducedMotion = useReducedMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const fillHeight = 180 * clamped;
  const particlesEnabled = phase === 'working' && !prefersReducedMotion;

  const particles = useMemo(
    () =>
      Array.from({ length: MAX_PARTICLES }, (_, index): Particle => ({
        id: index,
        x: 20 + ((index * 17) % 60),
        delay: (index % 10) * 0.35,
        size: 4 + (index % 3),
      })),
    [],
  );

  const [visibleParticles, setVisibleParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!particlesEnabled) {
      setVisibleParticles([]);
      return;
    }

    setVisibleParticles(particles.slice(0, Math.max(4, Math.round(clamped * MAX_PARTICLES))));
  }, [particlesEnabled, particles, clamped]);

  return (
    <div className={cn('relative mx-auto w-full max-w-[160px]', className)} aria-hidden="true">
      <svg viewBox="0 0 120 240" className="h-auto w-full">
        <defs>
          <linearGradient id="salary-jar-fill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="salary-jar-body">
            <path d="M35 40 H85 V70 C85 95 95 110 95 140 V210 C95 225 82 232 60 232 C38 232 25 225 25 210 V140 C25 110 35 95 35 70 Z" />
          </clipPath>
        </defs>

        <path
          d="M35 40 H85 V70 C85 95 95 110 95 140 V210 C95 225 82 232 60 232 C38 232 25 225 25 210 V140 C25 110 35 95 35 70 Z"
          fill="rgba(24,24,27,0.35)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2"
        />

        <g clipPath="url(#salary-jar-body)">
          <motion.rect
            x="20"
            width="80"
            fill="url(#salary-jar-fill)"
            initial={false}
            animate={{ y: 230 - fillHeight, height: fillHeight }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />

          {visibleParticles.map((particle) => (
            <motion.circle
              key={particle.id}
              cx={particle.x}
              r={particle.size}
              fill="#fef08a"
              opacity={0.85}
              initial={{ cy: 30, opacity: 0 }}
              animate={{
                cy: [30, 220],
                opacity: [0, 0.9, 0],
                rotate: [0, 180],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                delay: particle.delay,
                ease: 'easeIn',
              }}
            />
          ))}
        </g>

        <rect x="42" y="28" width="36" height="10" rx="4" fill="rgba(255,255,255,0.12)" />
      </svg>

      <div className="absolute inset-x-0 bottom-0 text-center text-xs text-zinc-500">
        {Math.round(clamped * 100)}%
      </div>
    </div>
  );
}
