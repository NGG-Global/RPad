import { clsx } from 'clsx';
import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors select-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-3.5 text-sm',
        variant === 'default' && 'bg-surface-2 border border-line text-ink hover:bg-surface-3',
        variant === 'primary' && 'bg-accent text-white hover:opacity-90',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        variant === 'danger' && 'bg-err/10 text-err border border-err/30 hover:bg-err/20',
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ className, label, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx('tap inline-flex items-center justify-center rounded-md text-ink-2 hover:bg-surface-3 hover:text-ink transition-colors', active && 'bg-accent-soft text-accent', className)}
      {...props}
    />
  );
}

export function Menu({ trigger, children, align = 'start', className }: { trigger: (open: () => void, isOpen: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end'; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={clsx('relative', className)}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div role="menu" className={clsx('absolute top-full z-40 mt-1 min-w-[220px] max-w-[90vw] rounded-lg border border-line bg-surface shadow-xl p-1', align === 'end' ? 'end-0' : 'start-0')}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, disabled, danger, hint }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={clsx('flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-start text-sm hover:bg-surface-3 transition-colors', danger && 'text-err')}
    >
      {icon && <span className="shrink-0 text-ink-2">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-ink-3 font-mono ltr-code">{hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

export function Dialog({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={clsx('flex max-h-[92dvh] w-full flex-col rounded-xl border border-line bg-surface shadow-2xl', wide ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton label="close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto scroll-thin p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none';

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-3 border-t-accent', className)} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-3">{children}</div>;
}
