import type { ReactNode, SelectHTMLAttributes } from 'react';

type SelectControlProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  containerClassName?: string;
};

export function SelectControl({ className = '', containerClassName = 'w-full', children, style, ...props }: SelectControlProps) {
  return (
    <span className={`relative inline-flex max-w-full ${containerClassName}`}>
      <select
        {...props}
        style={{ ...style, appearance: 'none', paddingRight: '2.75rem' }}
        className={`w-full appearance-none ${className}`}
      >
        {children}
      </select>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500">
        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
