import { useRef, useState } from 'react';
import { Download, FolderOpen, Trash2, Upload, RefreshCw, FileText, Image as ImageIcon, Database } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { IconButton, EmptyState } from './ui';
import { downloadBlob, formatBytes } from '@/utils/download';
import { ImportCsvDialog } from './ImportCsvDialog';
import { IMAGE_EXTENSIONS } from '@/runtime/plots';

function fileIcon(name: string) {
  if (IMAGE_EXTENSIONS.test(name) || /\.pdf$/i.test(name)) return <ImageIcon size={15} />;
  if (/\.(rdata|rda|rds)$/i.test(name)) return <Database size={15} />;
  return <FileText size={15} />;
}

export function FilesPanel() {
  const { t } = useTranslate();
  const files = useAppStore((s) => s.files);
  const workdir = useAppStore((s) => s.workdir);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);
  const askConfirm = useAppStore((s) => s.askConfirm);
  const toast = useAppStore((s) => s.toast);
  const input = useRef<HTMLInputElement>(null);
  const [pendingCsv, setPendingCsv] = useState<{ file: File; bytes: Uint8Array } | null>(null);

  const onPick = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) {
      setPendingCsv({ file, bytes });
      return;
    }
    if (lower.endsWith('.r')) {
      await workspace.createScript(file.name.replace(/\.r$/i, ''), new TextDecoder().decode(bytes));
      return;
    }
    await workspace.uploadFile(file.name, bytes);
    if (/\.(rdata|rda)$/i.test(lower)) {
      workspace.runCode(`load(${JSON.stringify(file.name)})`, 'console');
    } else {
      toast('success', file.name);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="files-panel">
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-2 py-1">
        <FolderOpen size={15} className="text-ink-3" />
        <span className="min-w-0 truncate font-mono text-[12px] text-ink-2 ltr-code" title={workdir}>{workdir.replace('/home/web_user', '~')}</span>
        <div className="ms-auto flex items-center">
          <IconButton label={t('refresh')} onClick={() => void workspace.queue.enqueue('files', () => workspace.refreshFiles())} disabled={runtimeStatus !== 'ready'} className="h-8 w-8 min-h-0 min-w-0"><RefreshCw size={15} /></IconButton>
          <IconButton label={t('uploadFile')} onClick={() => input.current?.click()} disabled={runtimeStatus === 'idle' || runtimeStatus === 'loading'} className="h-8 w-8 min-h-0 min-w-0" data-testid="upload-file"><Upload size={15} /></IconButton>
        </div>
        <input ref={input} type="file" accept=".csv,.txt,.tsv,.R,.r,.RData,.rda,.rds,text/csv,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); e.target.value = ''; }} data-testid="file-input" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {files.length === 0 ? (
          <EmptyState>{t('noFiles')}</EmptyState>
        ) : (
          <ul>
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-2 border-b border-line/60 px-2 py-1" data-testid="vfs-file" data-name={f.name}>
                <span className="text-ink-3">{fileIcon(f.name)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[13px] ltr-code">{f.name}</span>
                <span className="text-xs text-ink-3">{formatBytes(f.size)}</span>
                <IconButton label={t('download')} onClick={async () => downloadBlob(await workspace.readFileBlob(f.name), f.name)} className="h-8 w-8 min-h-0 min-w-0" data-testid="download-file"><Download size={15} /></IconButton>
                <IconButton label={t('deleteFile')} onClick={async () => { if (await askConfirm({ title: t('deleteFile'), body: t('deleteFileConfirm', { name: f.name }), danger: true })) await workspace.deleteFile(f.name); }} className="h-8 w-8 min-h-0 min-w-0"><Trash2 size={15} /></IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-line px-2 py-1 text-[11px] text-ink-3">{t('exportPlotFromR')}</div>
      {pendingCsv && <ImportCsvDialog file={pendingCsv.file} bytes={pendingCsv.bytes} onClose={() => setPendingCsv(null)} />}
    </div>
  );
}
