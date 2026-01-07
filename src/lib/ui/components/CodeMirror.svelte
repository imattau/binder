<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from "codemirror"
  import { EditorState } from "@codemirror/state"
  import { markdown } from "@codemirror/lang-markdown"

  let { value = $bindable(), onchange } = $props();

  let element: HTMLElement;
  let view: EditorView;

  function updateValue(v: string) {
      if (v !== value) {
          value = v;
          if (onchange) onchange(v);
      }
  }

  function applyChanges(change: { from: number; to: number; insert: string }, selection: { anchor: number; head?: number }) {
    if (!view) return;
    const transaction = {
      changes: change,
      selection: { anchor: selection.anchor, head: selection.head ?? selection.anchor },
      scrollIntoView: true
    };
    view.dispatch(transaction);
    view.focus();
  }

  export function insertText(text: string) {
    if (!view) return;
    const sel = view.state.selection.main;
    applyChanges({ from: sel.from, to: sel.to, insert: text }, { anchor: sel.from + text.length });
  }

  export function wrapSelection(prefix: string, suffix = '', placeholder = '') {
    if (!view) return;
    const sel = view.state.selection.main;
    const selected = view.state.sliceDoc(sel.from, sel.to);
    const content = selected || placeholder;
    const insert = `${prefix}${content}${suffix}`;
    const anchor = sel.from + prefix.length;
    const head = anchor + content.length;
    applyChanges({ from: sel.from, to: sel.to, insert }, { anchor, head });
  }

  export function insertAtLineStart(prefix: string) {
    if (!view) return;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    applyChanges({ from: line.from, to: line.from, insert: prefix }, { anchor: sel.from + prefix.length, head: sel.to + prefix.length });
  }

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            updateValue(update.state.doc.toString());
          }
        })
      ]
    });

    view = new EditorView({
      state,
      parent: element
    });
  });

  onDestroy(() => {
    view?.destroy();
  });

  $effect(() => {
      if (view && value !== view.state.doc.toString()) {
          view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: value }
          });
      }
  });
</script>

<div bind:this={element} class="h-full w-full overflow-hidden text-base"></div>

<style>
    :global(.cm-editor) {
        height: 100%;
    }
    :global(.cm-scroller) {
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    }
</style>
