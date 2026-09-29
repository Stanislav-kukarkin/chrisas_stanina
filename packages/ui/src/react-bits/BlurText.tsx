import { motion } from 'motion/react';

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'p';
  align?: 'left' | 'center';
}

export function BlurText({
  text,
  className = '',
  delay = 0.04,
  as: Tag = 'h1',
  align = 'center',
}: BlurTextProps) {
  const words = text.split(' ');

  return (
    <Tag
      className={`flex flex-wrap gap-x-3 ${align === 'center' ? 'justify-center' : ''} ${className}`}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ filter: 'blur(12px)', opacity: 0, y: 12 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: index * delay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}
