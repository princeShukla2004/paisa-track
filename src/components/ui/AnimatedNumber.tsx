import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  formatter: (val: number) => string;
  durationMs?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  formatter,
  durationMs = 480,
  className = '',
}: AnimatedNumberProps) {
  const [displayVal, setDisplayVal] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplayVal(value);
      prevRef.current = value;
      return;
    }

    const startVal = prevRef.current;
    const diff = value - startVal;
    if (Math.abs(diff) < 0.01) {
      setDisplayVal(value);
      prevRef.current = value;
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayVal(startVal + diff * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        prevRef.current = value;
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <span className={`tabular-nums ${className}`}>{formatter(displayVal)}</span>;
}
