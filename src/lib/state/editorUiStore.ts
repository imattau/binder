import { writable } from 'svelte/store';

interface EditorUiState {
    pane: 'split' | 'edit' | 'preview';
    lastAutoSave: number | null;
    isSaving: boolean;
}

export const editorUiStore = writable<EditorUiState>({
    pane: 'edit',
    lastAutoSave: null,
    isSaving: false
});
