import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { Plus, Play, MoreVertical, Save, Pencil, Trash2, Download, Upload, FileCode2, ChevronsRight } from 'lucide-react';
import { createEditorState, selectionOrLine, linesFrom, textOfLines, moveCursorToLine, insertText } from '@/editor/setup';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { Button, IconButton, Menu, MenuItem, MenuSeparator, Dialog, Field, inputClass } from './ui';
import { SymbolBar } from './SymbolBar';
import { courseTemplate } from '@/course/template';
import { editorBridge } from '@/editor/bridge';
import { downloadText } from '@/utils/download';
import { clsx } from 'clsx';

export function EditorPanel() {
  const { t } = useTranslate();
  const scripts = useAppStore((s) => s.scripts);
  const activeScriptId = useAppStore((s) => s.activeScriptId);
  const dirty = useAppStore((s) => s.scriptDirty);
  const symbolBar = useAppStore((s) => s.symbolBar);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);
  const toast = useAppStore((s) => s.toast);
  const askConfirm = useAppStore((s) => s.askConfirm);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplWeek, setTplWeek] = useState(1);
  const [tplStudent, setTplStudent] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  /** Run-line requests are serialised so rapid keypresses see the advanced cursor. */
  const runChain = useRef<Promise<void>>(Promise.resolve());

  const active = scripts.find((s) => s.id === activeScriptId) ?? null;

  const runText = useCallback((code: string) => {
    if (!code.trim()) return;
    workspace.runCode(code, 'script');
  }, []);

  /** Resolve the expression extent with R's parser, run it, and optionally move the cursor past it. */
  const runLineNow = useCallback(
    async (advance: boolean) => {
      const view = viewRef.current;
      if (!view) return;
      const sel = selectionOrLine(view);
      if (sel.isSelection) {
        runText(sel.text);
        if (advance) moveCursorToLine(view, sel.toLine + 1);
        return;
      }
      // Skip blank/comment lines.
      let start = sel.fromLine;
      const doc = view.state.doc;
      while (start <= doc.lines && /^\s*(#.*)?$/.test(doc.line(start).text)) start++;
      if (start > doc.lines) return;
      const n = await workspace.completeExpressionLength(linesFrom(view, start));
      const end = start + Math.max(1, n) - 1;
      runText(textOfLines(view, start, end));
      if (advance) moveCursorToLine(view, end + 1);
      view.focus();
    },
    [runText],
  );

  /** Run the selection or the complete expression at the cursor; optionally advance. */
  const runLine = useCallback(
    (advance: boolean) => {
      runChain.current = runChain.current.then(() => runLineNow(advance)).catch(() => undefined);
      return runChain.current;
    },
    [runLineNow],
  );

  const runAll = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    runText(view.state.doc.toString());
  }, [runText]);

  const save = useCallback(() => {
    const id = activeIdRef.current;
    if (id) void workspace.saveScript(id).then(() => toast('success', t('saved'), 1500));
  }, [toast, t]);

  // Mount the editor once.
  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({ parent: hostRef.current });
    viewRef.current = view;
    editorBridge.insert = (text) => insertText(view, (view.state.selection.main.from === 0 || text.startsWith('\n') ? '' : '\n') + text + '\n');
    return () => {
      editorBridge.insert = null;
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Swap document when the active script changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !active) return;
    if (activeIdRef.current === active.id) return;
    activeIdRef.current = active.id;
    const id = active.id;
    view.setState(
      createEditorState(
        active.content,
        { runLine: () => void runLine(false), runLineAndAdvance: () => void runLine(true), runAll, save },
        (doc) => workspace.updateScriptContent(id, doc),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Keep the editor's cursor visible when the Android keyboard resizes the viewport.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const view = viewRef.current;
      if (view && view.hasFocus) view.dispatch({ scrollIntoView: true });
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const exportScript = () => {
    if (!active) return;
    downloadText(active.content, active.name.endsWith('.R') ? active.name : `${active.name}.R`, 'text/x-r;charset=utf-8');
  };

  const importScript = async (file: File) => {
    const text = await file.text();
    await workspace.createScript(file.name.replace(/\.[rR]$/, ''), text);
  };

  const busy = runtimeStatus === 'busy' || runtimeStatus === 'installing';

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" data-testid="editor-panel">
      {/* Script tabs */}
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-1" role="tablist">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-thin">
          {scripts.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === activeScriptId}
              onClick={() => void workspace.setActiveScript(s.id)}
              className={clsx(
                'tap flex shrink-0 items-center gap-1 rounded-t-md border-b-2 px-3 text-[13px] font-mono ltr-code',
                s.id === activeScriptId ? 'border-accent bg-surface text-ink' : 'border-transparent text-ink-2 hover:bg-surface-3',
              )}
            >
              <FileCode2 size={14} className="opacity-60" />
              {s.name}
              {dirty[s.id] && <span className="text-warn">•</span>}
            </button>
          ))}
          <IconButton label={t('newScript')} onClick={() => void workspace.createScript()}><Plus size={18} /></IconButton>
        </div>
        <Menu
          align="end"
          trigger={(open) => <IconButton label={t('actions')} onClick={open}><MoreVertical size={18} /></IconButton>}
        >
          {(close) => (
            <>
              <MenuItem icon={<Save size={16} />} onClick={() => (close(), save())} hint="Ctrl+S">{t('save')}</MenuItem>
              <MenuItem icon={<Pencil size={16} />} onClick={() => (close(), setRenameValue(active?.name ?? ''), setRenameOpen(true))}>{t('rename')}</MenuItem>
              <MenuItem icon={<Download size={16} />} onClick={() => (close(), exportScript())}>{t('exportScript')}</MenuItem>
              <MenuItem icon={<Upload size={16} />} onClick={() => (close(), fileInput.current?.click())}>{t('importScript')}</MenuItem>
              <MenuItem icon={<FileCode2 size={16} />} onClick={() => (close(), setTemplateOpen(true))}>{t('template')}</MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Trash2 size={16} />}
                danger
                onClick={async () => {
                  close();
                  if (active && (await askConfirm({ title: t('deleteScript'), body: active.name, danger: true, confirmLabel: t('deleteScript') }))) await workspace.deleteScript(active.id);
                }}
              >
                {t('deleteScript')}
              </MenuItem>
            </>
          )}
        </Menu>
        <input ref={fileInput} type="file" accept=".R,.r,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importScript(f); e.target.value = ''; }} />
      </div>

      {/* Run toolbar */}
      <div className="flex items-center gap-1 border-b border-line px-1.5 py-1" dir="ltr">
        <Button size="sm" variant="primary" onClick={() => void runLine(false)} disabled={!active} title={t('runLineHint')} data-testid="run-line">
          <Play size={14} /> {t('runLine')}
        </Button>
        <Button size="sm" onClick={() => void runLine(true)} disabled={!active} title="Shift+Enter">
          <ChevronsRight size={14} />
        </Button>
        <Button size="sm" onClick={runAll} disabled={!active} title={t('runAllHint')} data-testid="run-all">
          <Play size={14} /> {t('runAll')}
        </Button>
        <span className="ms-auto hidden text-[11px] text-ink-3 md:inline">{busy ? t('busy') : t('keyboardHint')}</span>
      </div>

      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden ltr-code" data-testid="editor" />

      {symbolBar && (
        <SymbolBar
          onInsert={(text, cursor) => viewRef.current && insertText(viewRef.current, text, cursor)}
          onHide={() => void workspace.setSetting('symbolBar', false)}
        />
      )}

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={t('rename')}
        footer={
          <>
            <Button onClick={() => setRenameOpen(false)}>{t('cancel')}</Button>
            <Button variant="primary" onClick={() => { if (active) void workspace.renameScript(active.id, renameValue); setRenameOpen(false); }}>{t('ok')}</Button>
          </>
        }
      >
        <Field label={t('scriptName')}>
          <input className={clsx(inputClass, 'ltr-code')} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
        </Field>
      </Dialog>

      <Dialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={t('template')}
        footer={
          <>
            <Button onClick={() => setTemplateOpen(false)}>{t('cancel')}</Button>
            <Button
              variant="primary"
              onClick={async () => {
                setTemplateOpen(false);
                await workspace.createScript(`week${tplWeek}`, courseTemplate({ week: tplWeek, student: tplStudent }));
              }}
            >
              {t('newScript')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('week')}>
            <input type="number" min={1} max={13} className={inputClass} value={tplWeek} onChange={(e) => setTplWeek(Number(e.target.value) || 1)} />
          </Field>
          <Field label="Student name (optional)">
            <input className={clsx(inputClass, 'ltr-code')} value={tplStudent} onChange={(e) => setTplStudent(e.target.value)} placeholder="First Last" />
          </Field>
          <pre className="console-pre ltr-code max-h-48 overflow-auto rounded-md border border-line bg-surface-2 p-2 text-xs">{courseTemplate({ week: tplWeek, student: tplStudent }).slice(0, 400)}…</pre>
        </div>
      </Dialog>
    </div>
  );
}
