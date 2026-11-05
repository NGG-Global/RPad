import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { StreamLanguage, type StreamParser, bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { tags } from '@lezer/highlight';

export const rLanguage = StreamLanguage.define(r as unknown as StreamParser<unknown>);

const highlight = HighlightStyle.define([
  { tag: tags.keyword, class: 'tok-keyword' },
  { tag: tags.string, class: 'tok-string' },
  { tag: tags.number, class: 'tok-number' },
  { tag: tags.comment, class: 'tok-comment' },
  { tag: tags.operator, class: 'tok-operator' },
  { tag: tags.variableName, class: 'tok-variableName' },
  { tag: tags.atom, class: 'tok-atom' },
  { tag: tags.bool, class: 'tok-bool' },
  { tag: tags.function(tags.variableName), class: 'tok-function' },
]);

const R_WORDS = [
  'print', 'class', 'typeof', 'as.numeric', 'as.character', 'factor', 'levels', 'c', 'seq', 'sample', 'set.seed', 'rnorm', 'rbinom', 'runif',
  'data.frame', 'head', 'tail', 'names', 'dim', 'nrow', 'ncol', 'length', 'unique', 'summary', 'mean', 'median', 'sd', 'min', 'max', 'quantile',
  'rowSums', 'rowMeans', 'colSums', 'colMeans', 'table', 'library', 'filter', 'select', 'arrange', 'mutate', 'summarise', 'summarize', 'group_by', 'n',
  'ggplot', 'aes', 'geom_histogram', 'geom_dotplot', 'geom_boxplot', 'geom_density', 'geom_point', 'xlim', 'ylim', 'xlab', 'ylab', 'ggsave', 'hist', 'boxplot', 'plot',
  'dir', 'getwd', 'read.csv', 'write.csv', 'save', 'load', 'View', 'str', 'is.na', 'na.rm', 'TRUE', 'FALSE', 'NULL', 'NA', 'function', 'return', 'if', 'else', 'for', 'while',
  'paste', 'paste0', 'round', 'sum', 'abs', 'sqrt', 'exp', 'log', 'ifelse', 'rep', 'which', 'nchar', 'matrix', 'rbind', 'cbind', 'apply', 'lapply', 'sapply', 'lm', 'glm', 'predict', 'AIC',
];

function rCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-z._][A-Za-z0-9._]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const doc = context.state.doc.toString();
  const names = new Set<string>(R_WORDS);
  for (const m of doc.matchAll(/\b([A-Za-z.][A-Za-z0-9._]*)\s*(?:<-|=)/g)) names.add(m[1]);
  for (const m of doc.matchAll(/\b([A-Za-z.][A-Za-z0-9._]*)\s*=/g)) names.add(m[1]);
  const envNames = (globalThis as { __rpadEnvNames?: string[] }).__rpadEnvNames ?? [];
  for (const n of envNames) names.add(n);
  const options = [...names].filter((n) => n !== word.text).map((label) => ({ label, type: R_WORDS.includes(label) ? 'function' : 'variable' }));
  return { from: word.from, options, validFor: /^[A-Za-z0-9._]*$/ };
}

export interface EditorCommands {
  runLine: () => void;
  runLineAndAdvance: () => void;
  runAll: () => void;
  save: () => void;
}

export const fontCompartment = new Compartment();
export const readOnlyCompartment = new Compartment();

export function createEditorState(doc: string, commands: EditorCommands, onChange: (doc: string) => void, extra: Extension[] = []): EditorState {
  const runKeys = keymap.of([
    { key: 'Mod-Enter', run: () => (commands.runLine(), true) },
    { key: 'Shift-Enter', run: () => (commands.runLineAndAdvance(), true) },
    { key: 'Mod-Shift-Enter', run: () => (commands.runAll(), true) },
    { key: 'Mod-s', run: () => (commands.save(), true) },
  ]);
  return EditorState.create({
    doc,
    extensions: [
      runKeys,
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ override: [rCompletions], activateOnTyping: false }),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      syntaxHighlighting(highlight),
      rLanguage,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange(u.state.doc.toString());
      }),
      EditorView.contentAttributes.of({ dir: 'ltr', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', 'aria-label': 'R script editor' }),
      fontCompartment.of([]),
      readOnlyCompartment.of([]),
      ...extra,
    ],
  });
}

/** Text of the selection, or the current line when nothing is selected. */
export function selectionOrLine(view: EditorView): { text: string; fromLine: number; toLine: number; isSelection: boolean } {
  const sel = view.state.selection.main;
  if (!sel.empty) {
    const from = view.state.doc.lineAt(sel.from).number;
    const to = view.state.doc.lineAt(sel.to).number;
    return { text: view.state.sliceDoc(sel.from, sel.to), fromLine: from, toLine: to, isSelection: true };
  }
  const line = view.state.doc.lineAt(sel.head);
  return { text: line.text, fromLine: line.number, toLine: line.number, isSelection: false };
}

export function linesFrom(view: EditorView, fromLine: number, max = 60): string[] {
  const doc = view.state.doc;
  const out: string[] = [];
  for (let n = fromLine; n <= doc.lines && out.length < max; n++) out.push(doc.line(n).text);
  return out;
}

export function textOfLines(view: EditorView, fromLine: number, toLine: number): string {
  const doc = view.state.doc;
  return doc.sliceString(doc.line(fromLine).from, doc.line(Math.min(toLine, doc.lines)).to);
}

/** Move the cursor to the start of the line after `line`, scrolling it into view. */
export function moveCursorToLine(view: EditorView, line: number): void {
  const doc = view.state.doc;
  const target = Math.min(line, doc.lines);
  const pos = doc.line(target).from;
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
}

export function insertText(view: EditorView, text: string, cursorOffset?: number): void {
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + (cursorOffset ?? text.length) },
    scrollIntoView: true,
  });
  view.focus();
}
