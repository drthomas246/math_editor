import { applyPatches, enablePatches, produceWithPatches, type Patch } from "immer";
import { create } from "zustand";

import type { Worksheet } from "../../domain/worksheet/worksheet";

enablePatches();

export type HistoryEntry = {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  createdAt: number;
};

type EditorState = {
  worksheet: Worksheet | null;
  revision: number;
  savedRevision: number;
  saveStatus: "saved" | "dirty" | "saving" | "failed";
  selectedProblemId: string | null;
  selectedContentId: string | null;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  initialize: (worksheet: Worksheet) => void;
  commit: (label: string, worksheet: Worksheet) => void;
  selectProblem: (id: string | null) => void;
  selectContent: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  markSaving: () => void;
  markSaved: (revision: number) => void;
  markFailed: () => void;
  clear: () => void;
};

const MAX_HISTORY = 100;

export const useEditorStore = create<EditorState>((set, get) => ({
  worksheet: null,
  revision: 0,
  savedRevision: 0,
  saveStatus: "saved",
  selectedProblemId: null,
  selectedContentId: null,
  undoStack: [],
  redoStack: [],

  initialize: (worksheet) => set({
    worksheet,
    revision: 0,
    savedRevision: 0,
    saveStatus: "saved",
    selectedProblemId: worksheet.problems[0]?.id ?? null,
    selectedContentId: null,
    undoStack: [],
    redoStack: [],
  }),

  commit: (label, nextWorksheet) => {
    const current = get().worksheet;
    if (!current || JSON.stringify(current) === JSON.stringify(nextWorksheet)) return;
    const [, patches, inversePatches] = produceWithPatches(current, (draft) => {
      Object.assign(draft, nextWorksheet);
    });
    const entry: HistoryEntry = { label, patches, inversePatches, createdAt: Date.now() };
    set((state) => ({
      worksheet: nextWorksheet,
      revision: state.revision + 1,
      saveStatus: "dirty",
      undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY),
      redoStack: [],
    }));
  },

  selectProblem: (id) => set({ selectedProblemId: id }),
  selectContent: (id) => set({ selectedContentId: id }),

  undo: () => {
    const state = get();
    const entry = state.undoStack.at(-1);
    if (!entry || !state.worksheet) return;
    set({
      worksheet: applyPatches(state.worksheet, entry.inversePatches),
      revision: state.revision + 1,
      saveStatus: "dirty",
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    });
  },

  redo: () => {
    const state = get();
    const entry = state.redoStack.at(-1);
    if (!entry || !state.worksheet) return;
    set({
      worksheet: applyPatches(state.worksheet, entry.patches),
      revision: state.revision + 1,
      saveStatus: "dirty",
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
    });
  },

  markSaving: () => set({ saveStatus: "saving" }),
  markSaved: (revision) => set((state) => ({
    savedRevision: Math.max(state.savedRevision, revision),
    saveStatus: Math.max(state.savedRevision, revision) === state.revision ? "saved" : "dirty",
  })),
  markFailed: () => set({ saveStatus: "failed" }),
  clear: () => set({ worksheet: null, undoStack: [], redoStack: [] }),
}));
