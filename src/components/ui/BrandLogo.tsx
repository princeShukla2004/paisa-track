import React from 'react';

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandLogo({ className = '', showWordmark = true, size = 'md' }: BrandLogoProps) {
  const iconSize = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSize} shrink-0`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="paisaLogoGrad" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B5CF6" />
            <stop offset="0.6" stopColor="#6D28D9" />
            <stop offset="1" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#paisaLogoGrad)" />
        <path
          d="M11 23.5V12.5C11 11.67 11.67 11 12.5 11H19.2C22.25 11 24.5 12.92 24.5 15.6C24.5 18.28 22.25 20.2 19.2 20.2H14.2V23.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 24.5L20.5 21L23 23.5L26.5 19.5"
          stroke="#67E8F9"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${textSize}`}>
          PaisaTrack
        </span>
      )}
    </span>
  );
}
