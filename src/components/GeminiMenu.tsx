import { ClipboardCopy, ExternalLink, FileText, MessageSquareShare, Sparkles } from 'lucide-react';
import { Menu, MenuItem, MenuSeparator, Button } from './ui';
import { useAppStore } from '@/store/app-store';
import { useTranslate } from '@/hooks/useTranslate';
import { copyText } from '@/utils/clipboard';
import { formatCode, formatOutput, formatCodeAndOutput, formatGeminiContext, formatTranscript, relevantObjects, GEMINI_URL } from '@/gemini/format';
import { downloadText } from '@/utils/download';
import type { ExecutionRecord } from '@/types';

export function useGeminiActions() {
  const { t, lang } = useTranslate();
  const toast = useAppStore((s) => s.toast);
  const env = useAppStore((s) => s.env);

  const copy = async (text: string) => {
    const ok = await copyText(text);
    toast(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'));
    return ok;
  };

  return {
    copyCode: (e: ExecutionRecord) => copy(formatCode(e)),
    copyOutput: (e: ExecutionRecord) => copy(formatOutput(e)),
    copyBoth: (e: ExecutionRecord) => copy(formatCodeAndOutput(e)),
    copyGemini: (e: ExecutionRecord) => copy(formatGeminiContext(e, { objects: relevantObjects(e.code, env), language: lang })),
    copyMany: (execs: ExecutionRecord[]) => copy(execs.map((e) => formatCodeAndOutput(e)).join('\n----\n\n')),
    copyTranscript: async (execs: ExecutionRecord[]) => {
      const { text, truncated, included } = formatTranscript(execs);
      const ok = await copy(text);
      if (ok && truncated) toast('warning', t('transcriptTruncated', { n: included }), 6000);
    },
    exportTranscript: (execs: ExecutionRecord[]) => {
      const text = execs.map((e) => `> ${e.code.split('\n').join('\n> ')}\n${formatOutput(e)}\n`).join('\n');
      downloadText(text, `rpad-transcript-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`);
    },
    openGemini: () => {
      window.open(GEMINI_URL, '_blank', 'noopener');
      toast('info', t('openGeminiHint'), 5000);
    },
  };
}

/** Top-level "Copy for Gemini" menu operating on the latest or selected executions. */
export function GeminiMenu() {
  const { t } = useTranslate();
  const executions = useAppStore((s) => s.executions);
  const selected = useAppStore((s) => s.selectedExecutionIds);
  const actions = useGeminiActions();
  const finished = executions.filter((e) => e.status === 'done' || e.status === 'error');
  const latest = finished[finished.length - 1];
  const selectedExecs = finished.filter((e) => selected.includes(e.id));

  return (
    <Menu
      align="end"
      trigger={(open) => (
        <Button variant="primary" size="sm" onClick={open} className="gap-1.5" data-testid="gemini-menu">
          <Sparkles size={15} />
          <span className="hidden sm:inline">{t('copyForGemini')}</span>
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon={<MessageSquareShare size={16} />} disabled={!latest} onClick={() => (close(), latest && actions.copyGemini(latest))}>
            {t('copyGeminiContext')} · {t('copyLatest').toLowerCase()}
          </MenuItem>
          <MenuItem icon={<ClipboardCopy size={16} />} disabled={!latest} onClick={() => (close(), latest && actions.copyBoth(latest))}>
            {t('copyBoth')} · {t('copyLatest').toLowerCase()}
          </MenuItem>
          {selectedExecs.length > 0 && (
            <MenuItem icon={<ClipboardCopy size={16} />} onClick={() => (close(), actions.copyMany(selectedExecs))}>
              {t('copySelection')} ({selectedExecs.length})
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={<ClipboardCopy size={16} />} disabled={finished.length === 0} onClick={() => (close(), actions.copyTranscript(finished))}>
            {t('copyTranscript')}
          </MenuItem>
          <MenuItem icon={<FileText size={16} />} disabled={finished.length === 0} onClick={() => (close(), actions.exportTranscript(finished))}>
            {t('exportTranscript')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<ExternalLink size={16} />} onClick={() => (close(), actions.openGemini())}>
            {t('openGemini')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
