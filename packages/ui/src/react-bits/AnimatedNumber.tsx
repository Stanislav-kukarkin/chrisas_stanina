import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../lib/cn';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
  'aria-label'?: string;
}

export function AnimatedNumber({
  value,
  format,
  className,
  'aria-label': ariaLabel,
}: AnimatedNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number | null>(null);
  const displayRef = useRef(value);
  const startRef = useRef({ from: value, to: value, startedAt: 0 });

  useEffect(() => {
    displayRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    startRef.current = {
      from: displayRef.current,
      to: value,
      startedAt: performance.now(),
    };

    const animate = (now: number) => {
      const { from, to, startedAt } = startRef.current;
      const duration = 280;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayValue(from + (to - from) * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, prefersReducedMotion]);

  return (
    <motion.span
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn('tabular-nums', className)}
      key={Math.floor(value)}
      initial={prefersReducedMotion ? false : { scale: 1 }}
      animate={prefersReducedMotion ? undefined : { scale: [1, 1.02, 1] }}
      transition={{ duration: 0.25 }}
    >
      {format(displayValue)}
    </motion.span>
  );
}
