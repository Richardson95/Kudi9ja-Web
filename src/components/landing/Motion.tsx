import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView] as const;
}

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  style,
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      className={cn(
        'transition-[opacity,transform,filter] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
        inView ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-8 opacity-0 blur-[2px]',
        className,
      )}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Counts from 0 up to `to` once it is on screen. */
export function CountUp({ to, format = (n) => String(Math.round(n)), duration = 1600 }: { to: number; format?: (n: number) => string; duration?: number }) {
  const [ref, inView] = useInView<HTMLSpanElement>('0px');
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(to * (1 - Math.pow(1 - t, 4))); // ease-out quart
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return <span ref={ref}>{format(value)}</span>;
}

/** Cycles 0..count-1 every `ms`; picking one by hand restarts the clock. Holds while the tab is hidden. */
export function useCycle(count: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (count < 2) return;
    const id = window.setTimeout(function next() {
      if (document.hidden) return void (timer = window.setTimeout(next, ms));
      setI((n) => (n + 1) % count);
    }, ms);
    let timer = id;
    return () => window.clearTimeout(timer);
  }, [count, ms, i]);
  return [i, setI] as const;
}
