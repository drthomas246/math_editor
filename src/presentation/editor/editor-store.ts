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
export const DEFAULT_HISTORY_COALESCE_MS = 1000;
/**
 * isUpdatedAtPatchで表される条件を判定する。
 *
 * @param patch patchとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function isUpdatedAtPatch(patch: Patch): boolean {
    return patch.path.length === 1 && patch.path[0] === "updatedAt";
}
/**
 * readPatchValueで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @param path pathとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function readPatchValue(value: unknown, path: readonly (string | number)[]): unknown {
    let current = value;
    for (const segment of path) {
        if (current === null || typeof current !== "object")
            return undefined;
        current = (current as Record<string | number, unknown>)[segment];
    }
    return current;
}
/**
 * areValuesEqualに必要な処理を実行する。
 *
 * @param left leftとして使用する値
 * @param right rightとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function areValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((/**
             * すべての要素に求める条件を満たすか判定する。
             *
             * @param item 処理対象の値
             * @param index 対象となる位置
             * @returns 呼び出し元で使用する処理結果
             */
            function isMatchingItem1(item, index) {
                return areValuesEqual(item, right[index]);
            }));
    }
    if (left === null || right === null || typeof left !== "object" || typeof right !== "object")
        return false;
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((/**
         * すべての要素に求める条件を満たすか判定する。
         *
         * @param key keyとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function isMatchingItem2(key) {
            return Object.hasOwn(rightRecord, key) && areValuesEqual(leftRecord[key], rightRecord[key]);
        }));
}
/**
 * hasMeaningfulMutationで表される条件を判定する。
 *
 * @param current 更新前または現在の状態
 * @param next nextとして使用する値
 * @param patches patchesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function hasMeaningfulMutation(current: Worksheet, next: Worksheet, patches: readonly Patch[]): boolean {
    return patches.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param patch patchとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function hasMatchingItem3(patch) {
        return (!isUpdatedAtPatch(patch)
            && !areValuesEqual(readPatchValue(current, patch.path), readPatchValue(next, patch.path)));
    }));
}
/**
 * applyHistoryPatchesの対象となる状態を更新する。
 *
 * @param worksheet worksheetとして使用する値
 * @param patches patchesとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function applyHistoryPatches(worksheet: Worksheet, patches: readonly Patch[]): Worksheet {
    return {
        ...applyPatches(worksheet, patches),
        updatedAt: new Date().toISOString(),
    };
}
/**
 * appendHistoryEntryの対象となる要素を追加する。
 *
 * @param stack stackとして使用する値
 * @param entry 処理対象の値
 * @param canCoalesce canCoalesceとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function appendHistoryEntry(stack: readonly HistoryEntry[], entry: HistoryEntry, canCoalesce: boolean): HistoryEntry[] {
    const previous = stack.at(-1);
    if (canCoalesce
        && entry.historyGroup
        && previous?.historyGroup === entry.historyGroup) {
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
/**
 * isCurrentSessionで表される条件を判定する。
 *
 * @param state 更新前または現在の状態
 * @param request requestとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function isCurrentSession(state: Pick<EditorState, "worksheet" | "sessionId">, request: SaveRequest): boolean {
    return state.worksheet?.id === request.worksheetId && state.sessionId === request.sessionId;
}
/**
 * createSaveRequestで必要な値を作成する。
 *
 * @param state 更新前または現在の状態
 * @returns 呼び出し元で使用する処理結果
 */
export function createSaveRequest(state: Pick<EditorState, "worksheet" | "sessionId" | "revision">): SaveRequest | null {
    if (!state.worksheet)
        return null;
    return {
        worksheetId: state.worksheet.id,
        sessionId: state.sessionId,
        revision: state.revision,
    };
}
export const useEditorStore = create<EditorState>((/**
 * 設定に基づく初期状態または拡張を作成する。
 *
 * @param set setとして使用する値
 * @param get getとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createConfiguredState4(set, get) {
    return ({
        worksheet: null,
        sessionId: 0,
        revision: 0,
        savedRevision: 0,
        saveStatus: "saved",
        selectedProblemId: null,
        selectedContentId: null,
        undoStack: [],
        redoStack: [],
        initialize: (/**
         * initializeに必要な処理を実行する。
         *
         * @param worksheet worksheetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function initializeCallback5(worksheet) {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback6(state) {
                return ({
                    worksheet,
                    sessionId: state.sessionId + 1,
                    revision: 0,
                    savedRevision: 0,
                    saveStatus: "saved",
                    selectedProblemId: worksheet.problems[0]?.id ?? null,
                    selectedContentId: worksheet.problems[0]?.contents[0]?.id ?? null,
                    undoStack: [],
                    redoStack: [],
                });
            }));
        }),
        commit: (/**
         * commitの対象となる状態を更新する。
         *
         * @param label labelとして使用する値
         * @param nextWorksheet nextWorksheetとして使用する値
         */
        function commitCallback7(label, nextWorksheet) {
            const current = get().worksheet;
            if (!current || current === nextWorksheet)
                return;
            const [, patches, inversePatches] = produceWithPatches(current, (/**
             * produceWithPatchesへ渡す処理を実行する。
             *
             * @param draft draftとして使用する値
             */
            function produceWithPatchesCallback8(draft) {
                Object.assign(draft, nextWorksheet);
            }));
            if (patches.length === 0)
                return;
            const entry: HistoryEntry = { label, patches, inversePatches, createdAt: Date.now() };
            set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback9(state) {
                return ({
                    worksheet: nextWorksheet,
                    revision: state.revision + 1,
                    saveStatus: "dirty",
                    undoStack: appendHistoryEntry(state.undoStack, entry, false),
                    redoStack: [],
                });
            }));
        }),
        mutate: (/**
         * mutateの対象となる状態を更新する。
         *
         * @param label labelとして使用する値
         * @param change changeとして使用する値
         * @param options optionsとして使用する値
         */
        function mutateCallback10(label, change, options = {}) {
            const current = get().worksheet;
            if (!current)
                return;
            const createdAt = Date.now();
            const [nextWorksheet, patches, inversePatches] = produceWithPatches(current, (/**
             * produceWithPatchesへ渡す処理を実行する。
             *
             * @param draft draftとして使用する値
             */
            function produceWithPatchesCallback11(draft) {
                change(draft);
                draft.updatedAt = new Date(createdAt).toISOString();
            }));
            if (!hasMeaningfulMutation(current, nextWorksheet, patches))
                return;
            const entry: HistoryEntry = {
                label,
                patches,
                inversePatches,
                createdAt,
                ...(options.historyGroup ? { historyGroup: options.historyGroup } : {}),
            };
            const coalesceWindowMs = options.coalesceWindowMs ?? DEFAULT_HISTORY_COALESCE_MS;
            set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback12(state) {
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
            }));
        }),
        selectProblem: (/**
         * selectProblemで必要な値を取得する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function selectProblemCallback13(id) {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback14(state) {
                const problem = state.worksheet?.problems.find((/**
                 * 検索条件に一致する要素か判定する。
                 *
                 * @param item 処理対象の値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function findItem15(item) {
                    return item.id === id;
                }));
                const selectedContentId = problem?.contents.some((/**
                 * 条件に一致する要素か判定する。
                 *
                 * @param content contentとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function hasMatchingItem16(content) {
                    return content.id === state.selectedContentId;
                }))
                    ? state.selectedContentId
                    : problem?.contents[0]?.id ?? null;
                return { selectedProblemId: id, selectedContentId };
            }));
        }),
        selectContent: (/**
         * selectContentで必要な値を取得する。
         *
         * @param id 対象を識別するID
         * @returns 呼び出し元で使用する処理結果
         */
        function selectContentCallback17(id) {
            return set({ selectedContentId: id });
        }),
        undo: (/**
         * undoに必要な処理を実行する。
         */
        function undoCallback18() {
            const state = get();
            const entry = state.undoStack.at(-1);
            if (!entry || !state.worksheet)
                return;
            set({
                worksheet: applyHistoryPatches(state.worksheet, entry.inversePatches),
                revision: state.revision + 1,
                saveStatus: "dirty",
                undoStack: state.undoStack.slice(0, -1),
                redoStack: [...state.redoStack, entry],
            });
        }),
        redo: (/**
         * redoに必要な処理を実行する。
         */
        function redoCallback19() {
            const state = get();
            const entry = state.redoStack.at(-1);
            if (!entry || !state.worksheet)
                return;
            set({
                worksheet: applyHistoryPatches(state.worksheet, entry.patches),
                revision: state.revision + 1,
                saveStatus: "dirty",
                undoStack: [...state.undoStack, entry],
                redoStack: state.redoStack.slice(0, -1),
            });
        }),
        markSaving: (/**
         * markSavingの対象となる状態を更新する。
         *
         * @param request requestとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function markSavingCallback20(request) {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback21(state) {
                if (!isCurrentSession(state, request) || request.revision !== state.revision)
                    return state;
                return { saveStatus: "saving" };
            }));
        }),
        markSaved: (/**
         * markSavedの対象となる状態を更新する。
         *
         * @param request requestとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function markSavedCallback22(request) {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback23(state) {
                if (!isCurrentSession(state, request))
                    return state;
                const savedRevision = Math.max(state.savedRevision, request.revision);
                return {
                    savedRevision,
                    saveStatus: savedRevision === state.revision ? "saved" : "dirty",
                };
            }));
        }),
        markFailed: (/**
         * markFailedの対象となる状態を更新する。
         *
         * @param request requestとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function markFailedCallback24(request) {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback25(state) {
                if (!isCurrentSession(state, request) || request.revision !== state.revision)
                    return state;
                return { saveStatus: "failed" };
            }));
        }),
        clear: (/**
         * clearの対象となる要素を削除または解放する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function clearCallback26() {
            return set((/**
             * setへ渡す処理を実行する。
             *
             * @param state 更新前または現在の状態
             * @returns 呼び出し元で使用する処理結果
             */
            function setCallback27(state) {
                return ({
                    worksheet: null,
                    sessionId: state.sessionId + 1,
                    revision: 0,
                    savedRevision: 0,
                    saveStatus: "saved",
                    selectedProblemId: null,
                    selectedContentId: null,
                    undoStack: [],
                    redoStack: [],
                });
            }));
        }),
    });
}));
