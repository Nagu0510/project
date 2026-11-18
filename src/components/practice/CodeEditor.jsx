import React, { useEffect, useRef } from 'react';
import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { tags as t } from '@lezer/highlight';
import { useTheme } from '../../context/ThemeContext';

// Everything is bundled by Vite (no CDN), so the strict Content-Security-Policy keeps working.
const LANGUAGE_SUPPORT = { python, javascript, java, cpp, c: cpp };

// Colours come from the theme tokens (--syn-*, --code-*), so one highlight style serves both themes.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--syn-function)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--syn-type)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--syn-punct)' },
  { tag: t.invalid, color: 'var(--syn-invalid)' },
]);

const setErrorLines = StateEffect.define();
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setErrorLines)) {
        const total = tr.state.doc.lines;
        const marks = [...new Set(effect.value)]
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= total)
          .sort((a, b) => a - b)
          .map((n) => Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(n).from));
        deco = Decoration.set(marks);
      }
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

// `dark` tells CodeMirror which built-in base styles to use; every colour is a token, so only this flag needs a reconfigure on a theme change.
const themeFor = (fontSize, dark) => EditorView.theme({
  '&': { color: 'var(--code-text)', backgroundColor: 'var(--code-bg)', fontSize: `${fontSize}px`, height: '100%' },
  '&.cm-focused': { outline: '2px solid var(--focus-ring)', outlineOffset: '-2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--code-text)', padding: '8px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--code-text)' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--code-gutter)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--code-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active-line)', color: 'var(--code-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--code-selection)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--code-selection)', outline: '1px solid var(--border-strong)' },
  '.cm-error-line': { backgroundColor: 'var(--code-error-line)', boxShadow: 'inset 3px 0 0 var(--danger)' },
}, { dark });

/**
 * Code editor (CodeMirror 6): line numbers, syntax highlighting for the five languages, bracket matching and auto-closing, auto-indent,
 * Tab inserts spaces, Ctrl+Enter = run, Ctrl+Shift+Enter = submit. `errorLines` (1-based) are marked red.
 * The component is controlled by `value`, but typing updates the editor first, so there is no cursor jump.
 */
export const CodeEditor = ({ value, onChange, language, fontSize = 14, tabSize = 4, errorLines = [], onRun, onSubmit, readOnly = false, ariaLabel = 'Code editor' }) => {
  const host = useRef(null);
  const view = useRef(null);
  const handlers = useRef({ onChange, onRun, onSubmit });
  handlers.current = { onChange, onRun, onSubmit };
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const parts = useRef({ language: new Compartment(), theme: new Compartment(), tabs: new Compartment(), readOnly: new Compartment() });

  useEffect(() => {
    const p = parts.current;
    const run = () => { handlers.current.onRun?.(); return true; };
    const submit = () => { handlers.current.onSubmit?.(); return true; };
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        syntaxHighlighting(highlight),
        errorLineField,
        p.language.of((LANGUAGE_SUPPORT[language] || python)()),
        p.theme.of(themeFor(fontSize, dark)),
        p.tabs.of([EditorState.tabSize.of(tabSize), indentUnit.of(' '.repeat(tabSize))]),
        p.readOnly.of(EditorState.readOnly.of(readOnly)),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        Prec.highest(keymap.of([
          { key: 'Mod-Shift-Enter', run: submit, preventDefault: true },
          { key: 'Mod-Enter', run, preventDefault: true },
        ])),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current });
    view.current.dispatch({ effects: setErrorLines.of(errorLines) });
    return () => { view.current?.destroy(); view.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // a different problem / language / "load this code": replace the text
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: parts.current.language.reconfigure((LANGUAGE_SUPPORT[language] || python)()) });
  }, [language]);

  useEffect(() => {
    view.current?.dispatch({ effects: parts.current.theme.reconfigure(themeFor(fontSize, dark)) });
  }, [fontSize, dark]); // a theme change reconfigures the Compartment: the document, cursor and undo history stay

  useEffect(() => {
    view.current?.dispatch({ effects: parts.current.tabs.reconfigure([EditorState.tabSize.of(tabSize), indentUnit.of(' '.repeat(tabSize))]) });
  }, [tabSize]);

  useEffect(() => {
    view.current?.dispatch({ effects: parts.current.readOnly.reconfigure(EditorState.readOnly.of(readOnly)) });
  }, [readOnly]);

  const linesKey = errorLines.join(',');
  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLines.of(errorLines) });
  }, [linesKey, value]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} data-testid="code-editor" className="practice-code-editor" style={{ height: '100%', minHeight: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-mid)' }} />;
};

export default CodeEditor;
