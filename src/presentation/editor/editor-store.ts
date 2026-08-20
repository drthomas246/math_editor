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

export type SaveRequest = {
  worksheetId: string;
  sessionId: number;
  revision: number;
};

type EditorState = {
  worksheet: Worksheet | null;
  sessionId: number;
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
  markSaving: (request: SaveRequest) => void;
  markSaved: (request: SaveRequest) => void;
  markFailed: (request: SaveRequest) => void;
  clear: () => void;
};

const MAX_HISTORY = 100;

function isCurrentSession(
  state: Pick<EditorState, "worksheet" | "sessionId">,
  request: SaveRequest,
): boolean {
  return state.worksheet?.id === request.worksheetId && state.sessionId === request.sessionId;
}

export function createSaveRequest(
  state: Pick<EditorState, "worksheet" | "sessionId" | "revision">,
): SaveRequest | null {
  if (!state.worksheet) return null;
  return {
    worksheetId: state.worksheet.id,
    sessionId: state.sessionId,
    revision: state.revision,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  worksheet: null,
  sessionId: 0,
  revision: 0,
  savedRevision: 0,
  saveStatus: "saved",
  selectedProblemId: null,
  selectedContentId: null,
  undoStack: [],
  redoStack: [],

  initialize: (worksheet) => set((state) => ({
    worksheet,
    sessionId: state.sessionId + 1,
    revision: 0,
    savedRevision: 0,
    saveStatus: "saved",
    selectedProblemId: worksheet.problems[0]?.id ?? null,
    selectedContentId: null,
    undoStack: [],
    redoStack: [],
  })),

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

  markSaving: (request) => set((state) => {
    if (!isCurrentSession(state, request) || request.revision !== state.revision) return state;
    return { saveStatus: "saving" };
  }),
  markSaved: (request) => set((state) => {
    if (!isCurrentSession(state, request)) return state;
    const savedRevision = Math.max(state.savedRevision, request.revision);
    return {
      savedRevision,
      saveStatus: savedRevision === state.revision ? "saved" : "dirty",
    };
  }),
  markFailed: (request) => set((state) => {
    if (!isCurrentSession(state, request) || request.revision !== state.revision) return state;
    return { saveStatus: "failed" };
  }),
  clear: () => set((state) => ({
    worksheet: null,
    sessionId: state.sessionId + 1,
    revision: 0,
    savedRevision: 0,
    saveStatus: "saved",
    selectedProblemId: null,
    selectedContentId: null,
    undoStack: [],
    redoStack: [],
  })),
}));
