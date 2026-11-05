import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Dialog, Button, Field, inputClass } from './ui';
import { useTranslate } from '@/hooks/useTranslate';
import { workspace } from '@/runtime/workspace';
import { detectSeparator, decodeText, previewRows, toRName, buildReadCsvCode, type Separator } from '@/runtime/csv';

export function ImportCsvDialog({ file, bytes, onClose }: { file: File; bytes: Uint8Array; onClose: () => void }) {
  const { t } = useTranslate();
  const decoded = useMemo(() => decodeText(bytes), [bytes]);
  const [sep, setSep] = useState<Separator>(() => detectSeparator(decoded.text.slice(0, 5000)));
  const [header, setHeader] = useState(true);
  const [name, setName] = useState(() => toRName(file.name));
  const [encoding, setEncoding] = useState<string>(decoded.encoding === 'utf-8' ? 'utf-8' : 'CP1255');
  const rows = useMemo(() => previewRows(decoded.text, sep), [decoded.text, sep]);
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const code = buildReadCsvCode(name, safeName, sep, header, encoding === 'utf-8' ? 'utf-8' : 'CP1255');
  const validName = /^[A-Za-z.][A-Za-z0-9._]*$/.test(name);

  const run = async (withCode: boolean) => {
    await workspace.uploadFile(safeName, bytes);
    if (withCode) workspace.runCode(code, 'console');
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t('importCsvTitle')} · ${file.name}`}
      wide
      footer={
        <>
          <Button onClick={() => void run(false)}>{t('importOnlyFile')}</Button>
          <Button variant="primary" disabled={!validName} onClick={() => void run(true)} data-testid="csv-import-run">{t('importRun')}</Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Field label={t('objectName')}>
          <input className={clsx(inputClass, 'ltr-code', !validName && 'border-err')} value={name} onChange={(e) => setName(e.target.value)} data-testid="csv-object-name" />
        </Field>
        <Field label={t('separator')}>
          <select className={inputClass} value={sep} onChange={(e) => setSep(e.target.value as Separator)}>
            <option value=",">, (comma)</option>
            <option value=";">; (semicolon)</option>
            <option value={'\t'}>Tab</option>
            <option value="|">| (pipe)</option>
          </select>
        </Field>
        <Field label={t('encoding')}>
          <select className={inputClass} value={encoding} onChange={(e) => setEncoding(e.target.value)}>
            <option value="utf-8">UTF-8</option>
            <option value="CP1255">Windows-1255 (Hebrew)</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="h-5 w-5" /> {t('header')}
        </label>
      </div>
      <div className="mt-3 text-sm text-ink-2">{t('preview')}</div>
      <div className="mt-1 max-h-56 overflow-auto rounded-md border border-line scroll-thin" dir="ltr">
        <table className="min-w-full text-xs">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={clsx(i === 0 && header && 'bg-surface-2 font-semibold')}>
                {r.map((c, j) => (
                  <td key={j} className="whitespace-nowrap border-b border-line/60 px-2 py-1 ltr-code">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm text-ink-2">{t('rCodeToRun')}</div>
      <pre className="console-pre ltr-code mt-1 rounded-md border border-line bg-surface-2 p-2 text-xs">{code}</pre>
    </Dialog>
  );
}
