import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { AssetRecord, ImagePlacement, ImageWidthPercent, Worksheet } from "../../domain/worksheet/worksheet";
import { getProblemNumbers } from "../../domain/worksheet/worksheet.numbering";
import type { RichTextDocumentTarget } from "../../domain/worksheet/worksheet.commands";
import { useEditorStore } from "./editor-store";
import { ProblemCard } from "./ProblemCard";
export type ProblemListProps = {
    assetUrls: ReadonlyMap<string, string>;
    onAddImage: (problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => Promise<void>;
    onUpdateImage: (problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => Promise<void>;
    onToast: (message: string) => void;
};
type ProblemDescriptor = {
    id: string;
    index: number;
    displayNumber: string | null;
};
const getCurrentWorksheet = (/**
 * getCurrentWorksheetで必要な値を取得する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function getCurrentWorksheetImplementation1(): Worksheet | null {
    return useEditorStore.getState().worksheet;
});
export const ProblemList = memo((/**
 * ProblemListコンポーネントを表示する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function ProblemList(parameter1: ProblemListProps) {
    let { assetUrls, onAddImage, onUpdateImage, onToast } = parameter1;
    // リッチテキスト編集ではこれらのプリミティブ値が変わらないため、個別問題の変更で
    // 一覧全体を再描画せず、構造または採番が変わった場合だけ更新する。
    const structureKey = useEditorStore(useShallow((/**
     * useShallowへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useShallowCallback3(state) {
        const worksheet = state.worksheet;
        if (!worksheet)
            return [];
        return [
            worksheet.pageSettings.problemNumberFormat,
            worksheet.pageSettings.subQuestionNumberFormat,
            ...worksheet.problems.flatMap((/**
             * 各要素を変換しながら一つの配列へ展開する。
             *
             * @param problem problemとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function expandItem4(problem) {
                return [
                    problem.id,
                    problem.kind,
                    problem.numbering.enabled,
                    problem.numbering.restartAt,
                ];
            })),
        ];
    })));
    const descriptors = useMemo<ProblemDescriptor[]>((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue5() {
        // structureKeyだけを購読することで、リッチテキストのみの編集では一覧を再描画せず、
        // 構造変更時に限ってこのスナップショットを更新する。
        void structureKey;
        const worksheet = getCurrentWorksheet();
        if (!worksheet)
            return [];
        const numbers = getProblemNumbers(worksheet);
        return worksheet.problems.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param problem problemとして使用する値
         * @param index 対象となる位置
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem6(problem, index) {
            return ({
                id: problem.id,
                index,
                displayNumber: numbers.get(problem.id) ?? null,
            });
        }));
    }), [structureKey]);
    return <>{descriptors.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param descriptor descriptorとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem7(descriptor) {
            return <StoreProblemCard key={descriptor.id} descriptor={descriptor} assetUrls={assetUrls} onAddImage={onAddImage} onUpdateImage={onUpdateImage} onToast={onToast}/>;
        }))}</>;
}));
/**
 * StoreProblemCardコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function StoreProblemCard(props: ProblemListProps & {
    descriptor: ProblemDescriptor;
}) {
    let { descriptor, assetUrls, onAddImage, onUpdateImage, onToast } = props;
    const problem = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback8(state) {
        const candidate = state.worksheet?.problems[descriptor.index];
        return candidate?.id === descriptor.id
            ? candidate
            : state.worksheet?.problems.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem9(item) {
                return item.id === descriptor.id;
            }));
    }));
    const selected = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback10(state) {
        return state.selectedProblemId === descriptor.id;
    }));
    const selectedContentId = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback11(state) {
        return (state.selectedProblemId === descriptor.id ? state.selectedContentId : null);
    }));
    const selectProblem = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback12(state) {
        return state.selectProblem;
    }));
    const selectContent = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback13(state) {
        return state.selectContent;
    }));
    const commit = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback14(state) {
        return state.commit;
    }));
    const mutate = useEditorStore((/**
     * useEditorStoreへ渡す処理を実行する。
     *
     * @param state 更新前または現在の状態
     * @returns 呼び出し元で使用する処理結果
     */
    function useEditorStoreCallback15(state) {
        return state.mutate;
    }));
    const worksheet = getCurrentWorksheet();
    if (!worksheet || !problem)
        return null;
    return <ProblemCard worksheet={worksheet} getWorksheet={getCurrentWorksheet} problem={problem} index={descriptor.index} displayNumber={descriptor.displayNumber} selected={selected} selectedContentId={selectedContentId} onSelect={(/**
     * onSelectで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleSelect16() {
        return selectProblem(descriptor.id);
    })} onSelectContent={selectContent} onCommit={commit} onMutate={mutate} onAddImage={onAddImage} onUpdateImage={onUpdateImage} assetUrls={assetUrls} onToast={onToast}/>;
}
