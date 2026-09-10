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
 * イベント処理時点の最新プリントをエディタストアから取得する。
 *
 * @returns 編集中のプリント。未読込の場合はnull
 */
function getCurrentWorksheetImplementation1(): Worksheet | null {
    return useEditorStore.getState().worksheet;
});
export const ProblemList = memo((/**
 * プリント内の問題を採番順に並べ、選択中の問題だけを編集可能なカードとして表示する。
 *
 * @param callbackInput 画像URLと画像操作・通知用コールバック
 * @returns 採番済みの問題カード一覧
 */
function ProblemList(callbackInput: ProblemListProps) {
    let { assetUrls, onAddImage, onUpdateImage, onToast } = callbackInput;
    // リッチテキスト編集ではこれらのプリミティブ値が変わらないため、個別問題の変更で
    // 一覧全体を再描画せず、構造または採番が変わった場合だけ更新する。
    const structureKey = useEditorStore(useShallow((/**
     * use・Shallowをflat・Mapで処理し、その結果を呼び出し元へ反映する。
     *
     * @param state 更新前または現在の状態
     * @returns 後続処理が順番に扱う結果の配列
     */
    function useShallowCallback3(state) {
        const worksheet = state.worksheet;
        if (!worksheet)
            return [];
        return [
            worksheet.pageSettings.problemNumberFormat,
            worksheet.pageSettings.subQuestionNumberFormat,
            ...worksheet.problems.flatMap((/**
             * 各処理対象の問題または例題を0件以上の結果へ変換し、一つの配列へ展開する。
             *
             * @param problem 処理対象の問題または例題
             * @returns 順序を保った要素一覧
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
     * 順序を保った要素一覧を依存値から計算し、次の変更まで再利用する。
     *
     * @returns 依存値が変わるまで再利用する計算済みの派生値
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
         * 各処理対象の問題または例題を対象を一意に特定する識別子・位置・display・番号を持つオブジェクトへ変換する。
         *
         * @param problem 処理対象の問題または例題
         * @param index 対象となる位置
         * @returns 対象を一意に特定する識別子・位置・display・番号を持つオブジェクト
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
         * 各画面表示へ変換する問題の記述情報を画面表示用のReact要素へ変換する。
         *
         * @param descriptor 画面表示へ変換する問題の記述情報
         * @returns 画面表示用のReact要素
         */
        function mapItem7(descriptor) {
            return <StoreProblemCard key={descriptor.id} descriptor={descriptor} assetUrls={assetUrls} onAddImage={onAddImage} onUpdateImage={onUpdateImage} onToast={onToast}/>;
        }))}</>;
}));
/**
 * Store・問題・カードの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param props Store・問題・カードへ渡す表示情報と操作
 * @returns Store・問題・カードを表示するReact要素
 */
function StoreProblemCard(props: ProblemListProps & {
    descriptor: ProblemDescriptor;
}) {
    let { descriptor, assetUrls, onAddImage, onUpdateImage, onToast } = props;
    const problem = useEditorStore((/**
     * エディタストアから条件に応じて選択した値だけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 条件に応じて選択した値
     */
    function useEditorStoreCallback8(state) {
        const candidate = state.worksheet?.problems[descriptor.index];
        return candidate?.id === descriptor.id
            ? candidate
            : state.worksheet?.problems.find((/**
             * 要素の対象を一意に特定する識別子が画面表示へ変換する問題の記述情報の対象を一意に特定する識別子と一致する最初の要素を検索する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の対象を一意に特定する識別子が画面表示へ変換する問題の記述情報の対象を一意に特定する識別子と一致する場合はtrue
             */
            function findItem9(item) {
                return item.id === descriptor.id;
            }));
    }));
    const selected = useEditorStore((/**
     * エディタストアから二つの値を比較した結果だけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 二つの値を比較した結果
     */
    function useEditorStoreCallback10(state) {
        return state.selectedProblemId === descriptor.id;
    }));
    const selectedContentId = useEditorStore((/**
     * エディタストアから条件に応じて選択した値だけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 条件に応じて選択した値
     */
    function useEditorStoreCallback11(state) {
        return (state.selectedProblemId === descriptor.id ? state.selectedContentId : null);
    }));
    const selectProblem = useEditorStore((/**
     * エディタストアから状態のselect・問題だけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 状態のselect・問題
     */
    function useEditorStoreCallback12(state) {
        return state.selectProblem;
    }));
    const selectContent = useEditorStore((/**
     * エディタストアから状態のselect・内容だけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 状態のselect・内容
     */
    function useEditorStoreCallback13(state) {
        return state.selectContent;
    }));
    const commit = useEditorStore((/**
     * エディタストアから状態のcommitだけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 状態のcommit
     */
    function useEditorStoreCallback14(state) {
        return state.commit;
    }));
    const mutate = useEditorStore((/**
     * エディタストアから状態のmutateだけを購読対象として選択する。
     *
     * @param state 更新前または現在の状態
     * @returns 状態のmutate
     */
    function useEditorStoreCallback15(state) {
        return state.mutate;
    }));
    const worksheet = getCurrentWorksheet();
    if (!worksheet || !problem)
        return null;
    return <ProblemCard worksheet={worksheet} getWorksheet={getCurrentWorksheet} problem={problem} index={descriptor.index} displayNumber={descriptor.displayNumber} selected={selected} selectedContentId={selectedContentId} onSelect={(/**
     * 画面要素から選択操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleSelect16() {
        return selectProblem(descriptor.id);
    })} onSelectContent={selectContent} onCommit={commit} onMutate={mutate} onAddImage={onAddImage} onUpdateImage={onUpdateImage} assetUrls={assetUrls} onToast={onToast}/>;
}
