import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from "immer";
import { create } from "zustand";

import type { Worksheet } from "../../domain/worksheet/worksheet";

enablePatches();

export type HistoryEntry = {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  createdAt: number;
  historyGroup?: string;
};

export type WorksheetMutation = (worksheet: Draft<Worksheet>) => void;

export type MutationOptions = {
  historyGroup?: string;
  coalesceWindowMs?: number;
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
  mutate: (label: string, change: WorksheetMutation, options?: MutationOptions) => void;
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
export const DEFAULT_HISTORY_COALESCE_MS = 1_000;

function isUpdatedAtPatch(patch: Patch): boolean {
  return patch.path.length === 1 && patch.path[0] === "updatedAt";
}

function readPatchValue(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => areValuesEqual(item, right[index]));
  }
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(rightRecord, key) && areValuesEqual(leftRecord[key], rightRecord[key]));
}

function hasMeaningfulMutation(current: Worksheet, next: Worksheet, patches: readonly Patch[]): boolean {
  return patches.some((patch) => (
    !isUpdatedAtPatch(patch)
    && !areValuesEqual(readPatchValue(current, patch.path), readPatchValue(next, patch.path))
  ));
}

function appendHistoryEntry(
  stack: readonly HistoryEntry[],
  entry: HistoryEntry,
  canCoalesce: boolean,
): HistoryEntry[] {
  const previous = stack.at(-1);
  if (
    canCoalesce
    && entry.historyGroup
    && previous?.historyGroup === entry.historyGroup
  ) {
    return [
      ...stack.slice(0, -1),
      {
        label: entry.label,
        historyGroup: entry.historyGroup,
        patches: [...previous.patches, ...entry.patches],
        inversePatches: [...entry.inversePatches, ...previous.inversePatches],
        createdAt: entry.createdAt,
      },
    ];
  }
  return [...stack, entry].slice(-MAX_HISTORY);
}

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
    if (!current || current === nextWorksheet) return;
    const [, patches, inversePatches] = produceWithPatches(current, (draft) => {
      Object.assign(draft, nextWorksheet);
    });
    if (patches.length === 0) return;
    const entry: HistoryEntry = { label, patches, inversePatches, createdAt: Date.now() };
    set((state) => ({
      worksheet: nextWorksheet,
      revision: state.revision + 1,
      saveStatus: "dirty",
      undoStack: appendHistoryEntry(state.undoStack, entry, false),
      redoStack: [],
    }));
  },

  mutate: (label, change, options = {}) => {
    const current = get().worksheet;
    if (!current) return;
    const createdAt = Date.now();
    const [nextWorksheet, patches, inversePatches] = produceWithPatches(current, (draft) => {
      change(draft);
      draft.updatedAt = new Date(createdAt).toISOString();
    });
    if (!hasMeaningfulMutation(current, nextWorksheet, patches)) return;
    const entry: HistoryEntry = {
      label,
      patches,
      inversePatches,
      createdAt,
      ...(options.historyGroup ? { historyGroup: options.historyGroup } : {}),
    };
    const coalesceWindowMs = options.coalesceWindowMs ?? DEFAULT_HISTORY_COALESCE_MS;
    set((state) => {
      const previous = state.undoStack.at(-1);
      const canCoalesce = state.redoStack.length === 0
        && Boolean(entry.historyGroup)
        && previous !== undefined
        && previous?.historyGroup === entry.historyGroup
        && entry.createdAt - previous.createdAt <= coalesceWindowMs;
      return {
        worksheet: nextWorksheet,
        revision: state.revision + 1,
        saveStatus: "dirty",
        undoStack: appendHistoryEntry(state.undoStack, entry, canCoalesce),
        redoStack: [],
      };
    });
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
