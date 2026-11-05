import { useRef, useState } from 'react';
import { FolderPlus, Pencil, Trash2, Download, Upload, Camera, History, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { Dialog, Button, Field, inputClass, IconButton } from './ui';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { downloadBlob, formatBytes } from '@/utils/download';

export function ProjectsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useTranslate();
  const projects = useAppStore((s) => s.projects);
  const project = useAppStore((s) => s.project);
  const snapshots = useAppStore((s) => s.snapshots);
  const env = useAppStore((s) => s.env);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);
  const askConfirm = useAppStore((s) => s.askConfirm);
  const toast = useAppStore((s) => s.toast);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const rReady = runtimeStatus === 'ready';

  const create = async () => {
    if (!newName.trim()) return;
    await workspace.createProject(newName, { template: true });
    setNewName('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('projects')} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex gap-2">
            <input className={inputClass} placeholder={t('projectName')} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} data-testid="new-project-name" />
            <Button variant="primary" onClick={() => void create()} disabled={!newName.trim()} data-testid="new-project-create"><FolderPlus size={16} /> {t('newProject')}</Button>
          </div>
          <ul className="divide-y divide-line rounded-md border border-line">
            {projects.map((p) => (
              <li key={p.id} className={clsx('flex items-center gap-2 px-2 py-1.5', p.id === project?.id && 'bg-accent-soft/50')}>
                {renaming === p.id ? (
                  <input className={clsx(inputClass, 'h-9')} value={renameValue} autoFocus onChange={(e) => setRenameValue(e.target.value)} onBlur={async () => { await workspace.renameProject(p.id, renameValue); setRenaming(null); }} onKeyDown={async (e) => { if (e.key === 'Enter') { await workspace.renameProject(p.id, renameValue); setRenaming(null); } }} />
                ) : (
                  <button type="button" className="tap flex min-w-0 flex-1 items-center gap-2 text-start" onClick={async () => { await workspace.openProject(p.id); onClose(); }}>
                    <FolderOpen size={16} className="shrink-0 text-ink-3" />
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="ms-auto text-xs text-ink-3">{new Date(p.updatedAt).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB')}</span>
                  </button>
                )}
                <IconButton label={t('renameProject')} onClick={() => { setRenaming(p.id); setRenameValue(p.name); }} className="h-8 w-8 min-h-0 min-w-0"><Pencil size={15} /></IconButton>
                <IconButton label={t('deleteProject')} onClick={async () => { if (await askConfirm({ title: t('deleteProject'), body: t('deleteProjectConfirm', { name: p.name }), danger: true, confirmLabel: t('deleteProject') })) await workspace.deleteProject(p.id); }} className="h-8 w-8 min-h-0 min-w-0"><Trash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={async () => { const blob = await workspace.exportProject(); downloadBlob(blob, `${project?.name ?? 'project'}.rpad.json`); }} disabled={!project}><Download size={14} /> {t('exportProject')}</Button>
            <Button size="sm" onClick={() => importRef.current?.click()}><Upload size={14} /> {t('importProject')}</Button>
            <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { await workspace.importProject(f); onClose(); } catch (err) { toast('error', (err as Error).message); } } e.target.value = ''; }} />
          </div>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">{t('snapshot')}</div>
          <p className="mb-2 text-xs text-ink-3">{t('unsavedRuntime')}</p>
          <Button variant="primary" size="sm" onClick={() => void workspace.saveSnapshot()} disabled={!rReady || env.length === 0} data-testid="save-snapshot"><Camera size={14} /> {t('saveSnapshot')} ({env.length})</Button>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line">
            {snapshots.length === 0 && <li className="px-2 py-2 text-xs text-ink-3">{t('snapshotNone')}</li>}
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <History size={15} className="shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <div>{new Date(s.createdAt).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB')}</div>
                  <div className="truncate font-mono text-xs text-ink-3 ltr-code">{s.objectNames.join(', ')} · {formatBytes(s.size)}</div>
                </div>
                <Button size="sm" onClick={() => void workspace.restoreSnapshot(s)} disabled={!rReady} data-testid="restore-snapshot">{t('restore')}</Button>
                <IconButton label={t('deleteFile')} onClick={() => void workspace.deleteSnapshot(s.id)} className="h-8 w-8 min-h-0 min-w-0"><Trash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslate();
  const lang = useAppStore((s) => s.lang);
  const theme = useAppStore((s) => s.theme);
  const fontSize = useAppStore((s) => s.fontSize);
  const symbolBar = useAppStore((s) => s.symbolBar);
  const showReference = useAppStore((s) => s.showReference);
  const info = useAppStore((s) => s.runtimeInfo);
  const askConfirm = useAppStore((s) => s.askConfirm);
  const [usage, setUsage] = useState<string | null>(null);
  const [pkg, setPkg] = useState('');
  const packageProgress = useAppStore((s) => s.packageProgress);

  if (open && usage === null) {
    void import('@/persistence/db').then(async ({ repo }) => {
      const u = await repo.estimateUsage();
      setUsage(u ? t('storageUsage', { usage: formatBytes(u.usage), quota: formatBytes(u.quota) }) : '');
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('settings')}>
      <div className="space-y-4">
        <Field label={t('language')}>
          <select className={inputClass} value={lang} onChange={(e) => void workspace.setSetting('lang', e.target.value as 'he' | 'en')} data-testid="setting-lang">
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t('theme')}>
          <select className={inputClass} value={theme} onChange={(e) => void workspace.setSetting('theme', e.target.value as 'light' | 'dark' | 'system')}>
            <option value="system">{t('themeSystem')}</option>
            <option value="light">{t('themeLight')}</option>
            <option value="dark">{t('themeDark')}</option>
          </select>
        </Field>
        <Field label={`${t('fontSize')} (${fontSize}px)`}>
          <input type="range" min={11} max={22} value={fontSize} onChange={(e) => void workspace.setSetting('fontSize', Number(e.target.value))} className="w-full" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={symbolBar} onChange={(e) => void workspace.setSetting('symbolBar', e.target.checked)} /> {t('symbolBar')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={showReference} onChange={(e) => void workspace.setSetting('showReference', e.target.checked)} /> {t('showReference')}</label>
        <div>
          <div className="mb-1 text-sm font-semibold">{t('packages')}</div>
          <div className="flex gap-2">
            <input className={clsx(inputClass, 'ltr-code')} placeholder="dplyr" value={pkg} onChange={(e) => setPkg(e.target.value)} />
            <Button onClick={() => { const name = pkg.trim(); if (name) { workspace.runCode(`library(${name})`, 'console'); onClose(); } setPkg(''); }} disabled={!pkg.trim() || !info}>{t('installPackage')}</Button>
          </div>
          <p className="mt-1 text-xs text-ink-3">{t('installPackageHint')}</p>
          {packageProgress && <div className="mt-1 text-xs text-ink-3 ltr-code">{packageProgress.name}: {packageProgress.status} {packageProgress.detail ?? ''}</div>}
        </div>
        <div className="rounded-md border border-line bg-surface-2 p-3 text-xs text-ink-2">
          <div className="font-semibold text-ink">{t('about')}</div>
          {info ? <div className="ltr-code">{t('runtimeInfo', { webr: info.webrVersion, r: info.rVersion, channel: info.channel })}</div> : <div>—</div>}
          <div className="mt-1">{t('channelNote')}</div>
          {usage && <div className="mt-1">{usage}</div>}
          <div className="mt-1">{t('storageWarning')}</div>
          <Button size="sm" variant="danger" className="mt-2" onClick={async () => { if (await askConfirm({ title: t('restartR'), body: t('restartRConfirm'), danger: true })) await workspace.restartRuntime(); }}>{t('restartR')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
