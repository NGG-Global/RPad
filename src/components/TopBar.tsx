import { useState } from 'react';
import { BookOpen, ChevronDown, FolderOpen, Settings, Square, Loader2, CircleCheck, CircleAlert, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { Button, IconButton } from './ui';
import { GeminiMenu } from './GeminiMenu';
import { ProjectsDialog, SettingsDialog } from './ProjectsDialog';
import { formatBytes } from '@/utils/download';

export function TopBar() {
  const { t } = useTranslate();
  const project = useAppStore((s) => s.project);
  const status = useAppStore((s) => s.runtimeStatus);
  const progress = useAppStore((s) => s.runtimeProgress);
  const info = useAppStore((s) => s.runtimeInfo);
  const pkg = useAppStore((s) => s.packageProgress);
  const queueLength = useAppStore((s) => s.queueLength);
  const showReference = useAppStore((s) => s.showReference);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  let statusText = '';
  let statusIcon = <CircleCheck size={15} className="text-ok" />;
  if (status === 'loading') {
    statusIcon = <Loader2 size={15} className="animate-spin text-accent" />;
    statusText = progress?.phase === 'download' && progress.total ? t('downloadingEngine', { loaded: formatBytes(progress.loaded ?? 0), total: formatBytes(progress.total) }) : progress?.phase === 'prelude' ? t('preparingEngine') : progress?.phase === 'start' ? t('startingEngine') : t('loadingEngine');
  } else if (status === 'installing') {
    statusIcon = <Download size={15} className="pulse text-accent" />;
    statusText = pkg ? t('packageInstalling', { name: pkg.name }) : t('installing');
  } else if (status === 'busy') {
    statusIcon = <Loader2 size={15} className="animate-spin text-accent" />;
    statusText = t('busy') + (queueLength > 1 ? ` (+${queueLength - 1})` : '');
  } else if (status === 'error') {
    statusIcon = <CircleAlert size={15} className="text-err" />;
    statusText = t('errorState');
  } else if (status === 'ready') {
    statusText = t('ready');
  } else {
    statusIcon = <Loader2 size={15} className="text-ink-3" />;
    statusText = '…';
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line bg-surface-2 px-2" data-testid="topbar">
      <button type="button" className="tap flex min-w-0 items-center gap-1.5 rounded-md px-2 hover:bg-surface-3" onClick={() => setProjectsOpen(true)} data-testid="project-button">
        <FolderOpen size={17} className="shrink-0 text-accent" />
        <span className="truncate text-sm font-semibold">{project?.name ?? t('appName')}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-3" />
      </button>
      <div className={clsx('flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs', status === 'error' ? 'text-err' : 'text-ink-2')} title={info ? t('runtimeInfo', { webr: info.webrVersion, r: info.rVersion, channel: info.channel }) : undefined} data-testid="runtime-status" data-status={status}>
        {statusIcon}
        <span className="truncate">{statusText}</span>
        {pkg?.status === 'downloading' && pkg.detail && <span className="hidden truncate text-ink-3 md:inline ltr-code">· {pkg.detail}</span>}
      </div>
      {(status === 'busy' || status === 'installing') && (
        <Button size="sm" variant="danger" onClick={() => { workspace.interrupt(); workspace.queue.cancelAllPending(); }} title={info?.canInterrupt ? t('stop') : t('stopUnavailable')} data-testid="stop-button">
          <Square size={13} /> {t('stop')}
        </Button>
      )}
      <div className="ms-auto flex items-center gap-1">
        <GeminiMenu />
        <IconButton label={t('reference')} active={showReference} onClick={() => void workspace.setSetting('showReference', !showReference)} className="hidden md:inline-flex"><BookOpen size={18} /></IconButton>
        <IconButton label={t('settings')} onClick={() => setSettingsOpen(true)} data-testid="settings-button"><Settings size={18} /></IconButton>
      </div>
      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
