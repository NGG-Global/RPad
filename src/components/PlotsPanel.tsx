import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, Maximize2, Trash2, X, Eraser } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { IconButton, EmptyState } from './ui';
import { copyImage, canCopyImages } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { clsx } from 'clsx';

export function usePlotActions() {
  const { t } = useTranslate();
  const toast = useAppStore((s) => s.toast);
  return {
    copy: async (blob: Blob) => {
      if (!canCopyImages()) {
        toast('warning', t('copyPlotUnsupported'), 5000);
        return false;
      }
      const ok = await copyImage(blob);
      toast(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'));
      return ok;
    },
    download: (blob: Blob, name: string) => downloadBlob(blob, name),
  };
}

export function PlotsPanel() {
  const { t } = useTranslate();
  const plots = useAppStore((s) => s.plots);
  const activePlotId = useAppStore((s) => s.activePlotId);
  const set = useAppStore((s) => s.set);
  const askConfirm = useAppStore((s) => s.askConfirm);
  const [fullscreen, setFullscreen] = useState(false);
  const actions = usePlotActions();
  const idx = Math.max(0, plots.findIndex((p) => p.id === activePlotId));
  const plot = plots[idx];

  const go = (d: number) => {
    const next = plots[Math.min(plots.length - 1, Math.max(0, idx + d))];
    if (next) set({ activePlotId: next.id });
  };

  const fileName = (p: typeof plot) => p?.fileName ?? `plot-${new Date(p?.createdAt ?? 0).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="plots-panel">
      <div className="flex items-center gap-0.5 border-b border-line bg-surface-2 px-2 py-1" dir="ltr">
        <span className="text-[13px] font-semibold text-ink-2">{t('plots')}</span>
        {plots.length > 0 && <span className="text-xs text-ink-3">· {t('plotOf', { i: idx + 1, n: plots.length })}</span>}
        <div className="ms-auto flex items-center">
          <IconButton label={t('previous')} onClick={() => go(-1)} disabled={idx <= 0} className="h-8 w-8 min-h-0 min-w-0"><ChevronLeft size={16} /></IconButton>
          <IconButton label={t('next')} onClick={() => go(1)} disabled={idx >= plots.length - 1} className="h-8 w-8 min-h-0 min-w-0"><ChevronRight size={16} /></IconButton>
          <IconButton label={t('fullscreen')} onClick={() => setFullscreen(true)} disabled={!plot} className="h-8 w-8 min-h-0 min-w-0"><Maximize2 size={15} /></IconButton>
          <IconButton label={t('copyPlot')} onClick={() => plot && void actions.copy(plot.blob)} disabled={!plot} className="h-8 w-8 min-h-0 min-w-0" data-testid="plot-copy"><Copy size={15} /></IconButton>
          <IconButton label={t('downloadPng')} onClick={() => plot && actions.download(plot.blob, fileName(plot))} disabled={!plot} className="h-8 w-8 min-h-0 min-w-0" data-testid="plot-download"><Download size={15} /></IconButton>
          <IconButton label={t('deletePlot')} onClick={() => plot && void workspace.deletePlot(plot.id)} disabled={!plot} className="h-8 w-8 min-h-0 min-w-0"><Trash2 size={15} /></IconButton>
          <IconButton label={t('clearPlots')} onClick={async () => { if (plots.length && (await askConfirm({ title: t('clearPlots'), danger: true }))) await workspace.clearPlots(); }} disabled={plots.length === 0} className="h-8 w-8 min-h-0 min-w-0"><Eraser size={15} /></IconButton>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-surface-2 p-2" dir="ltr">
        {plot ? (
          <img src={plot.url} alt="R plot" className="max-h-full max-w-full rounded border border-line bg-white object-contain" data-testid="plot-image" onClick={() => setFullscreen(true)} />
        ) : (
          <EmptyState>{t('noPlots')}</EmptyState>
        )}
      </div>
      {plots.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-t border-line bg-surface-2 p-1 scroll-thin" dir="ltr">
          {plots.map((p, i) => (
            <button key={p.id} type="button" onClick={() => set({ activePlotId: p.id })} className={clsx('shrink-0 overflow-hidden rounded border bg-white', i === idx ? 'border-accent' : 'border-line')}>
              <img src={p.url} alt="" className="h-12 w-16 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {fullscreen && plot && <PlotLightbox url={plot.url!} onClose={() => setFullscreen(false)} onPrev={() => go(-1)} onNext={() => go(1)} hasPrev={idx > 0} hasNext={idx < plots.length - 1} onCopy={() => void actions.copy(plot.blob)} onDownload={() => actions.download(plot.blob, fileName(plot))} />}
    </div>
  );
}

/** Full screen viewer with pinch zoom and pan. */
function PlotLightbox({ url, onClose, onPrev, onNext, hasPrev, hasNext, onCopy, onDownload }: { url: string; onClose: () => void; onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean; onCopy: () => void; onDownload: () => void }) {
  const { t } = useTranslate();
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ scale: 1, x: 0, y: 0, pointers: new Map<number, { x: number; y: number }>(), lastDist: 0, dragging: false, lx: 0, ly: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const apply = () => force((n) => n + 1);
  const s = state.current;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 1) {
      s.dragging = true;
      s.lx = e.clientX;
      s.ly = e.clientY;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!s.pointers.has(e.pointerId)) return;
    s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (s.lastDist) s.scale = Math.min(8, Math.max(0.5, s.scale * (dist / s.lastDist)));
      s.lastDist = dist;
      apply();
    } else if (s.dragging) {
      s.x += e.clientX - s.lx;
      s.y += e.clientY - s.ly;
      s.lx = e.clientX;
      s.ly = e.clientY;
      apply();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    s.pointers.delete(e.pointerId);
    if (s.pointers.size < 2) s.lastDist = 0;
    if (s.pointers.size === 0) s.dragging = false;
  };
  const onWheel = (e: React.WheelEvent) => {
    s.scale = Math.min(8, Math.max(0.5, s.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    apply();
  };
  const reset = () => {
    s.scale = 1;
    s.x = 0;
    s.y = 0;
    apply();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white" dir="ltr" data-testid="plot-lightbox">
      <div className="flex items-center gap-1 p-2">
        <IconButton label={t('previous')} onClick={onPrev} disabled={!hasPrev} className="text-white"><ChevronLeft /></IconButton>
        <IconButton label={t('next')} onClick={onNext} disabled={!hasNext} className="text-white"><ChevronRight /></IconButton>
        <button type="button" className="rounded px-2 py-1 text-sm hover:bg-white/10" onClick={reset}>{Math.round(s.scale * 100)}%</button>
        <div className="ms-auto flex items-center gap-1">
          <IconButton label={t('copyPlot')} onClick={onCopy} className="text-white"><Copy /></IconButton>
          <IconButton label={t('downloadPng')} onClick={onDownload} className="text-white"><Download /></IconButton>
          <IconButton label={t('close')} onClick={onClose} className="text-white"><X /></IconButton>
        </div>
      </div>
      <div ref={ref} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onDoubleClick={reset}>
        <img src={url} alt="R plot" draggable={false} className="max-h-full max-w-full select-none bg-white" style={{ transform: `translate(${s.x}px, ${s.y}px) scale(${s.scale})`, transformOrigin: 'center' }} />
      </div>
    </div>
  );
}
