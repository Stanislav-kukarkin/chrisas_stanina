import type { ReactNode, SelectHTMLAttributes } from 'react';

type SelectControlProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export function SelectControl({ children, className = '', ...props }: SelectControlProps) {
  return (
    <span className="select-control">
      <select {...props} className={className}>
        {children}
      </select>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
        <path
          d="m5 7.5 5 5 5-5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
