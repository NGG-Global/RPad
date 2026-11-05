import { useAppStore } from '@/store/app-store';

export const SYMBOLS: { label: string; insert: string; cursor?: number }[] = [
  { label: '<-', insert: ' <- ' },
  { label: '|>', insert: ' |> ' },
  { label: '$', insert: '$' },
  { label: '[', insert: '[' },
  { label: ']', insert: ']' },
  { label: '(', insert: '()', cursor: 1 },
  { label: ')', insert: ')' },
  { label: ',', insert: ', ' },
  { label: '==', insert: ' == ' },
  { label: '%in%', insert: ' %in% ' },
  { label: 'TRUE', insert: 'TRUE' },
  { label: 'FALSE', insert: 'FALSE' },
  { label: '"', insert: '""', cursor: 1 },
  { label: '{', insert: '{\n  \n}', cursor: 4 },
  { label: '#', insert: '# ' },
  { label: '~', insert: ' ~ ' },
];

/** Compact R symbol toolbar shown above the software keyboard on touch devices. */
export function SymbolBar({ onInsert, onHide }: { onInsert: (text: string, cursor?: number) => void; onHide: () => void }) {
  const lang = useAppStore((s) => s.lang);
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-line bg-surface-2 px-1 py-1 scroll-thin" dir="ltr" role="toolbar" aria-label="R symbols">
      {SYMBOLS.map((s) => (
        <button
          key={s.label}
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onInsert(s.insert, s.cursor)}
          className="h-9 min-w-[44px] shrink-0 rounded-md border border-line bg-surface px-2 font-mono text-[13px] text-ink hover:bg-surface-3 active:bg-accent-soft"
        >
          {s.label}
        </button>
      ))}
      <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={onHide} className="ms-auto h-9 shrink-0 rounded-md px-2 text-xs text-ink-3 hover:bg-surface-3">
        {lang === 'he' ? 'הסתר' : 'Hide'}
      </button>
    </div>
  );
}
