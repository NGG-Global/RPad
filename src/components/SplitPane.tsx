import { useRef, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

/**
 * Two-pane split with a draggable divider (pointer events, works with touch and stylus).
 * `fraction` is the size of the first pane as a fraction of the container.
 */
export function SplitPane({ direction, fraction, onChange, first, second, min = 0.15, max = 0.85, className }: {
  direction: 'horizontal' | 'vertical';
  fraction: number;
  onChange: (f: number) => void;
  first: ReactNode;
  second: ReactNode;
  min?: number;
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const horizontal = direction === 'horizontal';

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    setActive(true);
    const move = (ev: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isRtl = getComputedStyle(el).direction === 'rtl';
      let f = horizontal ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
      if (horizontal && isRtl) f = 1 - f;
      onChange(Math.min(max, Math.max(min, f)));
    };
    const up = () => {
      setActive(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div ref={ref} className={clsx('flex min-h-0 min-w-0', horizontal ? 'flex-row' : 'flex-col', className)}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flex: `0 0 calc(${fraction * 100}% - 1px)` }}>{first}</div>
      <div role="separator" aria-orientation={horizontal ? 'vertical' : 'horizontal'} className={clsx(horizontal ? 'divider-v' : 'divider-h', active && 'active')} onPointerDown={onPointerDown} />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
