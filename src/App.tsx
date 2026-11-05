import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Code2, Terminal, Table2, ImageIcon, FolderOpen, Boxes } from 'lucide-react';
import { useAppStore, type PortraitTab, type SidePanel } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { dirFor } from '@/i18n';
import { TopBar } from '@/components/TopBar';
import { EditorPanel } from '@/components/EditorPanel';
import { ConsolePanel } from '@/components/ConsolePanel';
import { EnvironmentPanel } from '@/components/EnvironmentPanel';
import { FilesPanel } from '@/components/FilesPanel';
import { PlotsPanel } from '@/components/PlotsPanel';
import { DataViewer } from '@/components/DataViewer';
import { CourseReferencePanel } from '@/components/CourseReferencePanel';
import { SplitPane } from '@/components/SplitPane';
import { Toasts, ConfirmDialog, SnapshotRestorePrompt, FirstRunScreen, InstallPrompt } from '@/components/Overlays';
import { editorBridge } from '@/editor/bridge';
import { PwaUpdate } from '@/components/PwaUpdate';

function useOrientation(): 'landscape' | 'portrait' {
  const [o, setO] = useState<'landscape' | 'portrait'>(() => (window.innerWidth >= 900 && window.innerWidth > window.innerHeight * 0.9 ? 'landscape' : 'portrait'));
  useEffect(() => {
    const onResize = () => setO(window.innerWidth >= 900 && window.innerWidth > window.innerHeight * 0.9 ? 'landscape' : 'portrait');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return o;
}

function useTheme() {
  const theme = useAppStore((s) => s.theme);
  const fontSize = useAppStore((s) => s.fontSize);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1c20' : '#1f4e79');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
  }, [fontSize]);
}

export default function App() {
  const { t, lang } = useTranslate();
  const orientation = useOrientation();
  const dataViewer = useAppStore((s) => s.dataViewer);
  const set = useAppStore((s) => s.set);
  const showReference = useAppStore((s) => s.showReference);
  const layout = useAppStore((s) => s.layout);
  const portraitTab = useAppStore((s) => s.portraitTab);
  const sidePanel = useAppStore((s) => s.sidePanel);
  const env = useAppStore((s) => s.env);
  const [booted, setBooted] = useState(false);
  useTheme();

  useEffect(() => {
    void workspace.boot().then(() => setBooted(true));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  useEffect(() => {
    (globalThis as { __rpadEnvNames?: string[] }).__rpadEnvNames = env.map((o) => o.name);
  }, [env]);

  // Open the data viewer tab automatically in portrait mode.
  useEffect(() => {
    if (dataViewer && orientation === 'portrait') set({ portraitTab: 'data' });
  }, [dataViewer, orientation, set]);

  const insertExample = (code: string) => {
    editorBridge.insert?.(code);
    if (orientation === 'portrait') set({ portraitTab: 'editor' });
  };

  const closeViewer = () => set({ dataViewer: null });

  if (!booted) return <div className="flex h-full items-center justify-center text-ink-3">RPad…</div>;

  const sidePanels: { id: SidePanel; icon: JSX.Element; label: string }[] = [
    { id: 'environment', icon: <Boxes size={16} />, label: t('environment') },
    { id: 'files', icon: <FolderOpen size={16} />, label: t('files') },
    { id: 'plots', icon: <ImageIcon size={16} />, label: t('plots') },
  ];

  const sideContent = (
    <div className="flex h-full min-h-0 flex-col border-s border-line bg-surface">
      <div className="flex shrink-0 border-b border-line bg-surface-2" role="tablist">
        {sidePanels.map((p) => (
          <button key={p.id} role="tab" aria-selected={sidePanel === p.id} onClick={() => set({ sidePanel: p.id })} className={clsx('tap flex flex-1 items-center justify-center gap-1 border-b-2 text-[13px]', sidePanel === p.id ? 'border-accent text-ink' : 'border-transparent text-ink-2')} data-testid={`side-tab-${p.id}`}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {sidePanel === 'environment' && <EnvironmentPanel />}
        {sidePanel === 'files' && <FilesPanel />}
        {sidePanel === 'plots' && <PlotsPanel />}
      </div>
    </div>
  );

  const viewerOverlay = dataViewer && (
    <div className={clsx('absolute inset-0 z-30 bg-surface', orientation === 'portrait' && 'hidden')} data-testid="data-viewer-overlay">
      <DataViewer dfRef={dataViewer} onClose={closeViewer} />
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TopBar />
      <InstallPrompt />
      <PwaUpdate />
      <SnapshotRestorePrompt />
      {orientation === 'landscape' ? (
        <div className="relative flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <SplitPane
              direction="horizontal"
              fraction={1 - layout.sideFraction}
              onChange={(f) => void workspace.setSetting('layout', { ...layout, sideFraction: 1 - f })}
              min={0.4}
              max={0.85}
              className="h-full"
              first={
                <SplitPane
                  direction="vertical"
                  fraction={layout.editorFraction}
                  onChange={(f) => void workspace.setSetting('layout', { ...layout, editorFraction: f })}
                  className="h-full"
                  first={<EditorPanel />}
                  second={<ConsolePanel />}
                />
              }
              second={sideContent}
            />
          </div>
          {showReference && <div className="w-80 shrink-0"><CourseReferencePanel onInsert={insertExample} /></div>}
          {viewerOverlay}
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className={clsx('absolute inset-0', portraitTab !== 'editor' && 'hidden')}><EditorPanel /></div>
            <div className={clsx('absolute inset-0', portraitTab !== 'console' && 'hidden')}><ConsolePanel /></div>
            <div className={clsx('absolute inset-0', portraitTab !== 'data' && 'hidden')}>
              {dataViewer ? <DataViewer dfRef={dataViewer} onClose={closeViewer} /> : (
                <SplitPane direction="vertical" fraction={0.6} onChange={() => undefined} className="h-full" first={<EnvironmentPanel />} second={<FilesPanel />} />
              )}
            </div>
            <div className={clsx('absolute inset-0', portraitTab !== 'plots' && 'hidden')}><PlotsPanel /></div>
            {showReference && portraitTab === 'editor' && (
              <div className="absolute inset-y-0 end-0 z-20 w-72 shadow-xl"><CourseReferencePanel onInsert={insertExample} /></div>
            )}
          </div>
          <nav className="flex shrink-0 border-t border-line bg-surface-2 pb-[env(safe-area-inset-bottom)]" role="tablist" data-testid="portrait-tabs">
            {([
              { id: 'editor', icon: <Code2 size={18} />, label: t('editor') },
              { id: 'console', icon: <Terminal size={18} />, label: t('console') },
              { id: 'data', icon: <Table2 size={18} />, label: t('data') },
              { id: 'plots', icon: <ImageIcon size={18} />, label: t('plots') },
            ] as { id: PortraitTab; icon: JSX.Element; label: string }[]).map((tab) => (
              <button key={tab.id} role="tab" aria-selected={portraitTab === tab.id} onClick={() => set({ portraitTab: tab.id })} className={clsx('flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs', portraitTab === tab.id ? 'text-accent' : 'text-ink-2')} data-testid={`tab-${tab.id}`}>
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}
      <Toasts />
      <ConfirmDialog />
      <FirstRunScreen />
    </div>
  );
}
