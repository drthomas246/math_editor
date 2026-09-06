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
 * Updated・At・Patchが仕様上の条件を満たすか判定する。
 *
 * @param patch 履歴またはアセット参照を調べるImmerパッチ
 * @returns 履歴またはアセット参照を調べるImmerパッチの検証エラーが指すデータ位置のlengthが1と一致するかつ履歴またはアセット参照を調べるImmerパッチの検証エラーが指すデータ位置内の指定位置の値が「updatedAt」と一致する場合はtrue
 */
function isUpdatedAtPatch(patch: Patch): boolean {
    return patch.path.length === 1 && patch.path[0] === "updatedAt";
}
/**
 * Immerパッチが示すパスをたどり、履歴統合の比較対象となる値を読み取る。
 *
 * @param value パス探索を開始する状態または部分オブジェクト
 * @param path プロパティ名と配列位置で表したImmerパッチのパス
 * @returns パスが指す値。途中の要素が存在しない場合はundefined
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
 * are・Values・Equalをisで処理し、その結果を呼び出し元へ反映する。
 *
 * @param left 並び順を比較する左側の値
 * @param right 並び順を比較する右側の値
 * @returns この実装では常にtrue
 */
function areValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((/**
             * すべての要素について、are・Values・Equalの結果が真になるか検証する。
             *
             * @param item 配列処理で現在参照している要素
             * @param index 対象となる位置
             * @returns are・Values・Equalの結果が真になる場合はtrue
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
         * すべての保存先または要素を特定するキーに共通して要求する条件を検証する。
         *
         * @param key 保存先または要素を特定するキー
         * @returns has・Ownの結果が真になるかつare・Values・Equalの結果が真になる場合はtrue
         */
        function isMatchingItem2(key) {
            return Object.hasOwn(rightRecord, key) && areValuesEqual(leftRecord[key], rightRecord[key]);
        }));
}
/**
 * Meaningful・Mutationが仕様上の条件を満たすか判定する。
 *
 * @param current 更新前または現在の状態
 * @param next 適用候補となる次の値
 * @param patches 編集操作で生成されたImmerパッチ一覧
 * @returns someの結果が真になる場合はtrue
 */
function hasMeaningfulMutation(current: Worksheet, next: Worksheet, patches: readonly Patch[]): boolean {
    return patches.some((/**
     * いずれかの履歴またはアセット参照を調べるImmerパッチが要求条件を満たすか判定する。
     *
     * @param patch 履歴またはアセット参照を調べるImmerパッチ
     * @returns is・Updated・At・Patchの結果が存在しないかつare・Values・Equalの結果が存在しない場合はtrue
     */
    function hasMatchingItem3(patch) {
        return (!isUpdatedAtPatch(patch)
            && !areValuesEqual(readPatchValue(current, patch.path), readPatchValue(next, patch.path)));
    }));
}
/**
 * 履歴・Patchesを現在の編集結果へ反映する。
 *
 * @param worksheet 処理対象となるプリント
 * @param patches 編集操作で生成されたImmerパッチ一覧
 * @returns 値・updated・Atを持つオブジェクト
 */
function applyHistoryPatches(worksheet: Worksheet, patches: readonly Patch[]): Worksheet {
    return {
        ...applyPatches(worksheet, patches),
        updatedAt: new Date().toISOString(),
    };
}
/**
 * 履歴・項目を現在の編集結果へ反映する。
 *
 * @param stack UndoまたはRedoの履歴スタック
 * @param entry キーと値の組
 * @param canCoalesce 履歴を直前の操作へ統合できるかの判定結果
 * @returns 順序を保った要素一覧として得た要素一覧
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
 * 保存結果を現在の編集セッションへ反映してよいか判定する。
 *
 * @param state 更新前または現在の状態
 * @param request 自動保存の順序と内容を示す要求
 * @returns プリントIDとセッションIDが保存要求と一致する場合はtrue
 */
function isCurrentSession(state: Pick<EditorState, "worksheet" | "sessionId">, request: SaveRequest): boolean {
    return state.worksheet?.id === request.worksheetId && state.sessionId === request.sessionId;
}
/**
 * 現在の編集内容を識別できる保存要求を作る。
 *
 * @param state 更新前または現在の状態
 * @returns プリントID、セッションID、版番号を持つ保存要求。プリントがなければnull
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
 * @param set Zustand状態を更新する関数
 * @param get ストアの最新状態を取得する関数
 * @returns プリント、選択状態、編集履歴、保存状態と各操作を持つ初期ストア
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
         * 読み込んだプリントで新しい編集セッションを開始し、選択状態と履歴を初期化する。
         *
         * @param worksheet 処理対象となるプリント
         * @returns ストア更新処理の結果
         */
        function initializeCallback5(worksheet) {
            return set((/**
             * 更新前の状態から処理対象となるプリント・session・識別子・非同期更新の前後関係を判定する版番号・saved・版番号・保存・Statusを持つオブジェクトを作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 処理対象となるプリント・session・Id・非同期更新の前後関係を判定する版番号・saved・版番号・保存・Statusを持つオブジェクト
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
         * commitを現在の編集結果へ反映する。
         *
         * @param label 画面表示やテスト識別に使う名称
         * @param nextWorksheet 編集操作を適用した後のプリント
         */
        function commitCallback7(label, nextWorksheet) {
            const current = get().worksheet;
            if (!current || current === nextWorksheet)
                return;
            const [, patches, inversePatches] = produceWithPatches(current, (/**
             * produceWithPatchesが渡す更新対象へ、produce・With・Patchesで定義した変更を反映する。
             *
             * @param draft Immerが提供する更新中の状態
             */
            function produceWithPatchesCallback8(draft) {
                Object.assign(draft, nextWorksheet);
            }));
            if (patches.length === 0)
                return;
            const entry: HistoryEntry = { label, patches, inversePatches, createdAt: Date.now() };
            set((/**
             * 更新前の状態から処理対象となるプリント・非同期更新の前後関係を判定する版番号・保存・Status・undo・Stack・redo・Stackを持つオブジェクトを作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 処理対象となるプリント・非同期更新の前後関係を判定する版番号・保存・Status・undo・Stack・redo・Stackを持つオブジェクト
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
         * モックの呼び出し履歴から期待する操作名の更新関数を取り出す。
         *
         * @param label 画面表示やテスト識別に使う名称
         * @param change 適用する編集内容
         * @param options 処理方法を指定するオプション
         */
        function mutateCallback10(label, change, options = {}) {
            const current = get().worksheet;
            if (!current)
                return;
            const createdAt = Date.now();
            const [nextWorksheet, patches, inversePatches] = produceWithPatches(current, (/**
             * Immerが提供する更新中の状態のupdated・位置をto・ISO・Stringの結果へ更新する。
             *
             * @param draft Immerが提供する更新中の状態
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
             * 更新前の状態から処理対象となるプリント・非同期更新の前後関係を判定する版番号・保存・Status・undo・Stack・redo・Stackを持つオブジェクトを作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 処理対象となるプリント・非同期更新の前後関係を判定する版番号・保存・Status・undo・Stack・redo・Stackを持つオブジェクト
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
         * 指定した問題を選択し、その先頭の本文・解説も編集対象にする。
         *
         * @param id 対象を識別するID
         * @returns ストア更新処理の結果
         */
        function selectProblemCallback13(id) {
            return set((/**
             * 更新前の状態から選択中の問題の識別子・選択中の本文・解説の識別子を持つオブジェクトを作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 選択中の問題の識別子・選択中の本文・解説の識別子を持つオブジェクト
             */
            function setCallback14(state) {
                const problem = state.worksheet?.problems.find((/**
                 * 要素の対象を一意に特定する識別子が対象を一意に特定する識別子と一致する最初の要素を検索する。
                 *
                 * @param item 配列処理で現在参照している要素
                 * @returns 要素の対象を一意に特定する識別子が対象を一意に特定する識別子と一致する場合はtrue
                 */
                function findItem15(item) {
                    return item.id === id;
                }));
                const selectedContentId = problem?.contents.some((/**
                 * いずれかの処理対象の問題本文または解説が要求条件を満たすか判定する。
                 *
                 * @param content 処理対象の問題本文または解説
                 * @returns 処理対象の問題本文または解説の対象を一意に特定する識別子が状態の選択中の本文・解説の識別子と一致する場合はtrue
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
         * 編集対象の本文・解説を切り替える。
         *
         * @param id 対象を識別するID
         * @returns ストア更新処理の結果
         */
        function selectContentCallback17(id) {
            return set({ selectedContentId: id });
        }),
        undo: (/**
         * undoをストアの最新状態を取得する関数で処理し、その結果を呼び出し元へ反映する。
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
         * redoをストアの最新状態を取得する関数で処理し、その結果を呼び出し元へ反映する。
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
         * 現在の版に対する保存要求だけを保存中状態へ進める。
         *
         * @param request 自動保存の順序と内容を示す要求
         * @returns ストア更新処理の結果
         */
        function markSavingCallback20(request) {
            return set((/**
             * 更新前の状態から状態を作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 状態
             */
            function setCallback21(state) {
                if (!isCurrentSession(state, request) || request.revision !== state.revision)
                    return state;
                return { saveStatus: "saving" };
            }));
        }),
        markSaved: (/**
         * 同じ編集セッションの保存成功を記録し、最新版なら保存済み状態へ進める。
         *
         * @param request 自動保存の順序と内容を示す要求
         * @returns ストア更新処理の結果
         */
        function markSavedCallback22(request) {
            return set((/**
             * 更新前の状態から状態を作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 状態
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
         * 現在の版に対する保存要求だけを保存失敗状態へ進める。
         *
         * @param request 自動保存の順序と内容を示す要求
         * @returns ストア更新処理の結果
         */
        function markFailedCallback24(request) {
            return set((/**
             * 更新前の状態から状態を作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 状態
             */
            function setCallback25(state) {
                if (!isCurrentSession(state, request) || request.revision !== state.revision)
                    return state;
                return { saveStatus: "failed" };
            }));
        }),
        clear: (/**
         * 編集中のプリント・選択状態・履歴を破棄し、セッションIDを更新する。
         *
         * @returns ストア更新処理の結果
         */
        function clearCallback26() {
            return set((/**
             * 更新前の状態から処理対象となるプリント・session・識別子・非同期更新の前後関係を判定する版番号・saved・版番号・保存・Statusを持つオブジェクトを作り、対象ストアまたはプリントへ反映する。
             *
             * @param state 更新前または現在の状態
             * @returns 処理対象となるプリント・session・Id・非同期更新の前後関係を判定する版番号・saved・版番号・保存・Statusを持つオブジェクト
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
