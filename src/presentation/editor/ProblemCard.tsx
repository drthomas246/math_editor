import { ChevronDown, ChevronRight, Copy, GripVertical, MoreHorizontal, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import type { Draft } from "immer";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { colorDocumentAsAnswer, mergeColoredDocuments, type ContentColor } from "../../domain/worksheet/rich-text";
import type { AnswerArea, AssetRecord, BasicRichTextDocument, ContentBlock, ImagePlacement, ImageWidthPercent, ProblemBlock, TableCellRichTextDocument, Worksheet } from "../../domain/worksheet/worksheet";
import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type EditableTableData, type TableOperation } from "../../domain/worksheet/table-operations";
import { addContent, addSubQuestion, deleteContent, deleteProblem, deleteSubQuestion, duplicateProblem, moveContent, moveProblem, updateProblem, updateRichTextDocument, updateSubQuestion, type RichTextDocumentTarget, type WorksheetCommandResult, } from "../../domain/worksheet/worksheet.commands";
import { createContentBlock, emptyDocument, emptySolutionDocument } from "../../domain/worksheet/worksheet.defaults";
import { getSubQuestionNumbers } from "../../domain/worksheet/worksheet.numbering";
import { MathFormula } from "../components/MathFormula";
import { RichTextEditor } from "../components/RichTextEditor";
import { TableStructureToolbar } from "../components/TableStructureToolbar";
import { useOutsidePointerDown } from "../components/useOutsidePointerDown";
import type { EditableImageRef } from "../components/rich-text-editor-extensions";
import { ImageDialog, TableDialog } from "../dialogs/EditorDialogs";
import { WorksheetContentPreview, WorksheetSolutionPreview } from "../preview/WorksheetPreview";
import type { MutationOptions, WorksheetMutation } from "./editor-store";

// --------------------
// 型定義と定数
// --------------------

type MutateWorksheet = (label: string, change: WorksheetMutation, options?: MutationOptions) => void;
type Props = {
    worksheet: Worksheet;
    getWorksheet?: () => Worksheet | null;
    problem: ProblemBlock;
    index: number;
    displayNumber: string | null;
    selected: boolean;
    selectedContentId: string | null;
    onSelect: () => void;
    onSelectContent: (id: string | null) => void;
    onCommit: (label: string, worksheet: Worksheet) => void;
    onMutate: MutateWorksheet;
    onAddImage: (problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => Promise<void>;
    onUpdateImage: (problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => Promise<void>;
    assetUrls: ReadonlyMap<string, string>;
    onToast: (message: string) => void;
};
type AddContentType = Exclude<ContentBlock["type"], "image" | "table">;
const ADD_CONTENT_OPTIONS: ReadonlyArray<readonly [
    AddContentType,
    string
]> = [
    ["richText", "本文"],
    ["box", "囲み枠"],
    ["goal", "めあて"],
    ["subQuestionGroup", "小問"],
    ["answerArea", "解答欄"],
    ["spacer", "スペーサー"],
    ["pageBreak", "改ページ"],
];

// --------------------
// キーボード操作
// --------------------

/**
 * EnterまたはSpace操作をクリックと同じ編集開始操作へ変換する。
 *
 * @param event 発生したイベント
 * @param action 実行する編集操作
 */
function activateOnKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
    if (event.key !== "Enter" && event.key !== " ")
        return;
    event.preventDefault();
    event.stopPropagation();
    action();
}
/**
 * 一問分の種類・本文・解説・画像・表・小問を編集し、並べ替えや複製操作も提供する。
 *
 * @param props 問題・カードへ渡す表示情報と操作
 * @returns 問題・カードを表示するReact要素
 */
export function ProblemCard(props: Props) {
    const { worksheet, getWorksheet, problem, index, displayNumber, selected, selectedContentId, onSelect, onSelectContent, onCommit, onMutate, onAddImage, onUpdateImage, assetUrls, onToast } = props;

    // --------------------
    // 状態と参照
    // --------------------

    const readWorksheet = (/**
     * プリントを入力データまたは現在の状態から取り出す。
     *
     * @returns 二つの値を比較した結果
     */
    function readWorksheetImplementation1() {
        return getWorksheet?.() ?? worksheet;
    });
    const [problemMenu, setProblemMenu] = useState(false);
    const [addMenu, setAddMenu] = useState(false);
    const [solutionOpen, setSolutionOpen] = useState(false);
    const [tableTarget, setTableTarget] = useState<RichTextDocumentTarget | null | undefined>(undefined);
    const [imageDialog, setImageDialog] = useState<ImageDialogState | null>(null);
    const problemMenuRef = useRef<HTMLDivElement>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);
    useOutsidePointerDown(problemMenuRef, problemMenu, (/**
     * 問題・Menuを無効または非表示の状態へ戻す。
     */
    function useOutsidePointerDownCallback2() {
        return setProblemMenu(false);
    }));
    useOutsidePointerDown(addMenuRef, addMenu, (/**
     * Add・Menuを無効または非表示の状態へ戻す。
     */
    function useOutsidePointerDownCallback3() {
        return setAddMenu(false);
    }));
    // --------------------
    // 問題操作
    // --------------------

    const commit = (/**
     * commitを現在の編集結果へ反映する。
     *
     * @param label 画面表示やテスト識別に使う名称
     * @param result 処理によって得られた結果
     */
    function commitImplementation4(label: string, result: WorksheetCommandResult) {
        if (result.ok)
            onCommit(label, result.worksheet);
        else if (result.code === "LAST_ITEM")
            onToast("プリントには1問以上必要です");
        else if (result.code === "STRUCTURE_LIMIT_EXCEEDED")
            onToast("追加できる件数の上限に達しています");
    });
    const addBlock = (/**
     * ブロックを現在の編集結果へ反映する。
     *
     * @param type 作成または検証する要素種別
     */
    function addBlockImplementation5(type: AddContentType) {
        const content = createContentBlock(type);
        commit("内容を追加", addContent(readWorksheet(), problem.id, content, selectedContentId));
        onSelectContent(content.id);
        setAddMenu(false);
    });
    const solutionSelected = selected && selectedContentId === null;
    const toggleSolution = (/**
     * Solution・Openを無効または非表示の状態へ戻す。
     */
    function toggleSolutionImplementation6() {
        if (solutionOpen) {
            setSolutionOpen(false);
            if (solutionSelected)
                onSelectContent(problem.contents[0]?.id ?? null);
            return;
        }
        onSelect();
        onSelectContent(null);
        setSolutionOpen(true);
    });
    const selectSolution = (/**
     * Solutionを入力データまたは現在の状態から取り出す。
     */
    function selectSolutionImplementation7() {
        onSelect();
        onSelectContent(null);
    });
    // --------------------
    // 画面表示
    // --------------------

    return <article className={selected ? "problem-card selected" : "problem-card"} data-editor-problem-id={problem.id} onClick={onSelect}>
    <header className="problem-card-header">
      <div className="problem-title"><span className="drag-handle" aria-hidden="true"><GripVertical size={18}/></span><select className="problem-kind-select" aria-label="問題の種類" value={problem.kind} onClick={(/**
     * 「問題の種類」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleClick8(event) {
        return event.stopPropagation();
    })} onChange={(/**
     * 「問題の種類」要素のon・Changeを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange9(event) {
        return commit("問題の種類を変更", updateProblem(readWorksheet(), problem.id, (/**
         * 要素の種別をイベントの編集操作を適用する対象の値へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateProblemCallback10(item) { item.kind = event.target.value as typeof item.kind; })));
    })}><option value="problem">問題</option><option value="example">例題</option></select><span>{displayNumber ? displayNumber.replace(/[^0-9]/gu, "") || displayNumber : "番号なし"}</span>{problem.numbering.restartAt && <span className="status-chip">{problem.numbering.restartAt}から再開</span>}</div>
      <div className="problem-actions"><button className="small-button" disabled={worksheet.problems.length >= 200} onClick={(/**
     * 「複製」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleClick11(event) { event.stopPropagation(); commit("問題を複製", duplicateProblem(readWorksheet(), problem.id)); })}><Copy size={14}/>複製</button><div className="relative" ref={problemMenuRef}><button className="icon-button" aria-label="問題設定" onClick={(/**
     * 「問題設定」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleClick12(event) { event.stopPropagation(); setProblemMenu(!problemMenu); })}><MoreHorizontal size={18}/></button>{problemMenu && <ProblemMenu worksheet={worksheet} getWorksheet={readWorksheet} problem={problem} index={index} commit={commit} close={(/**
     * 問題・Menuを無効または非表示の状態へ戻す。
     */
    function closeCallback13() {
        return setProblemMenu(false);
    })}/>}</div></div>
    </header>
    <div className="content-list">
      {problem.contents.length === 0 && <div className="empty-problem"><p>{problem.kind === "example" ? "例題" : "問題"}{displayNumber ?? ""}には内容がありません。</p><span>「内容を追加」から編集を再開できます。</span></div>}
      {problem.contents.map((/**
     * 各処理対象の問題本文または解説を画面表示用のReact要素へ変換する。
     *
     * @param content 処理対象の問題本文または解説
     * @returns 画面表示用のReact要素
     */
    function mapItem14(content) {
        return <ContentEditor key={content.id} worksheet={worksheet} getWorksheet={readWorksheet} problem={problem} content={content} selected={selected && selectedContentId === content.id} onSelect={(/**
         * 画面要素から選択操作を受け、対応する編集状態と画面表示を更新する。
         */
        function handleSelect15() { onSelect(); onSelectContent(content.id); })} commit={commit} mutate={onMutate} assetUrls={assetUrls} onImage={(/**
         * 画面要素から画像挿入要求を受け、対応する編集状態と画面表示を更新する。
         *
         * @param target 編集操作を適用する対象
         */
        function handleImage16(target) {
            return setImageDialog({ mode: "insert", target });
        })} onEditImage={(/**
         * 画面要素から画像編集要求を受け、対応する編集状態と画面表示を更新する。
         *
         * @param target 編集操作を適用する対象
         * @param image 表示または編集する画像
         */
        function handleEditImage17(target, image) {
            return setImageDialog({ mode: "edit", target, image });
        })} onTable={setTableTarget}/>;
    }))}
    </div>
    <div className="solution-section">
      <button className="solution-toggle" aria-expanded={solutionOpen} onClick={(/**
     * 「:」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleClick18(event) { event.stopPropagation(); toggleSolution(); })}>{solutionOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}教師用の解説{problem.solution && <span className="status-chip">入力済み</span>}</button>
      {solutionOpen && (solutionSelected
            ? <div className="solution-editor"><label>解説</label><RichTextEditor document={(problem.solution ?? emptySolutionDocument()) as never} assetUrls={assetUrls} onChange={(/**
                 * 「解説」リッチ・テキスト・エディタ要素から入力変更を受け、on・Mutateとして親コンポーネントへ通知する。
                 *
                 * @param document 処理対象のリッチテキスト文書
                 */
                function handleChange19(document) {
                    return onMutate("教師用の解説を編集", (/**
                     * Mutateの通知内容を、対応する編集状態・DOM・永続処理へ反映する。
                     *
                     * @param draft Immerが提供する更新中の状態
                     */
                    function onMutateCallback20(draft) {
                        const target = draft.problems.find((/**
                         * 要素の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する最初の要素を検索する。
                         *
                         * @param item 配列処理で現在参照している要素
                         * @returns 要素の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する場合はtrue
                         */
                        function findItem21(item) {
                            return item.id === problem.id;
                        }));
                        if (target)
                            target.solution = document as never;
                    }), { historyGroup: `richText:${problem.id}:solution` });
                })} enableMath showColorSelector={false} onImage={(/**
             * 「解説」画面要素から画像挿入要求を受け、対応する編集状態と画面表示を更新する。
             */
            function handleImage22() {
                return setImageDialog({ mode: "insert", target: { kind: "solution" } });
            })} onEditImage={(/**
             * 「解説」画面要素から画像編集要求を受け、対応する編集状態と画面表示を更新する。
             *
             * @param image 表示または編集する画像
             */
            function handleEditImage23(image) {
                return setImageDialog({ mode: "edit", target: { kind: "solution" }, image });
            })} onTable={(/**
             * 「解説」画面要素から表挿入要求を受け、対応する編集状態と画面表示を更新する。
             */
            function handleTable24() {
                return setTableTarget({ kind: "solution" });
            })}/></div>
            : <div className="solution-editor solution-editor-static" role="button" tabIndex={0} aria-label="教師用の解説を編集" onKeyDown={(/**
             * 「教師用の解説を編集」要素のon・キー・Downを受け、対応する編集状態と画面表示を更新する。
             *
             * @param event 発生したイベント
             */
            function handleKeyDown25(event) {
                return activateOnKeyboard(event, selectSolution);
            })} onClick={(/**
             * 「教師用の解説を編集」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
             *
             * @param event 発生したイベント
             */
            function handleClick26(event) { event.stopPropagation(); selectSolution(); })}>
          <label>解説</label>
          {problem.solution
                    ? <WorksheetSolutionPreview document={problem.solution} assetUrls={assetUrls}/>
                    : <p className="solution-empty">クリックして解説を入力</p>}
        </div>)}
    </div>
    <div className="add-content-wrap" ref={addMenuRef}><button className="add-content-button" onClick={(/**
     * 「内容を追加」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleClick27(event) { event.stopPropagation(); setAddMenu(!addMenu); })}><Plus size={16}/>内容を追加</button>{addMenu && <div className="add-content-popover"><strong>追加する内容</strong><div>{ADD_CONTENT_OPTIONS.map((/**
     * 各作成または検証する要素種別と画面表示やテスト識別に使う名称の組を画面表示用のReact要素へ変換する。
     *
     * @param callbackInput コールバックの呼び出し元から渡される入力情報
     * @returns 画面表示用のReact要素
     */
    function mapItem28(callbackInput) {
        let [type, label] = callbackInput;
        return <button key={type} onClick={(/**
         * ボタンからクリック操作を受け、stop・Propagationを実行する。
         *
         * @param event 発生したイベント
         */
        function handleClick29(event) { event.stopPropagation(); addBlock(type); })}>{label}</button>;
    }))}</div></div>}</div>
    {tableTarget !== undefined && <TableDialog onClose={(/**
         * 表・ダイアログ要素から終了要求を受け、表・対象を操作内容に合う状態へ更新する。
         */
        function handleClose30() {
            return setTableTarget(undefined);
        })} onInsert={(/**
             * 表・ダイアログ要素から挿入要求を受け、commitを実行する。
             *
             * @param table 編集または検証の対象となる表
             */
            function handleInsert31(table) {
                if (tableTarget === null) {
                    commit("表を挿入", addContent(readWorksheet(), problem.id, table, selectedContentId));
                    onSelectContent(table.id);
                }
                else {
                    commit("表を挿入", updateRichTextDocument(readWorksheet(), problem.id, tableTarget, (/**
                     * updateRichTextDocumentが渡す更新対象へ、更新・リッチ・テキスト・文書で定義した変更を反映する。
                     *
                     * @param document 処理対象のリッチテキスト文書
                     */
                    function updateRichTextDocumentCallback32(document) {
                        document.content.push({ type: "richTable", attrs: { id: table.id, rows: table.rows, columnWidthsPercent: table.columnWidthsPercent, headerRow: table.headerRow, answerColor: tableTarget.kind !== "solution" && tableTarget.color === "answer" } });
                    })));
                    onSelectContent(tableTarget.kind === "content" ? tableTarget.contentId : tableTarget.kind === "subQuestion" ? tableTarget.groupId : null);
                }
                setTableTarget(undefined);
            })}/>}
    {imageDialog && <ImageDialog worksheetId={worksheet.id} {...(imageDialog.mode === "edit" ? { initial: { placement: imageDialog.image.placement, widthPercent: imageDialog.image.widthPercent, alt: imageDialog.image.alt, ...(assetUrls.get(imageDialog.image.assetId) ? { previewUrl: assetUrls.get(imageDialog.image.assetId)! } : {}) } } : {})} onClose={(/**
         * 画像・ダイアログ要素から終了要求を受け、画像・ダイアログを操作内容に合う状態へ更新する。
         */
        function handleClose33() {
            return setImageDialog(null);
        })} onApply={(/**
             * 画面要素から設定の適用要求を受け、対応する編集状態と画面表示を更新する。
             *
             * @param asset 処理対象の画像アセット
             * @param placement 画像を本文の前後どちらへ置くかの指定
             * @param width 要素または列へ適用する幅
             * @param alt 画像の代替テキスト
             */
            function handleApply34(asset, placement, width, alt) {
                if (imageDialog.mode === "insert") {
                    if (asset)
                        void onAddImage(problem.id, asset, placement, width, alt, imageDialog.target ?? undefined);
                }
                else {
                    void onUpdateImage(problem.id, imageDialog.image.id, asset, placement, width, alt, imageDialog.target ?? undefined);
                }
                setImageDialog(null);
            })}/>}
  </article>;
}

// --------------------
// 問題メニューとダイアログ
// --------------------

type ImageDialogState = {
    mode: "insert";
    target: RichTextDocumentTarget | null;
} | {
    mode: "edit";
    target: RichTextDocumentTarget | null;
    image: EditableImageRef;
};
/**
 * 問題種別・採番・移動・複製・削除の操作をまとめたメニューを表示する。
 *
 * @param props 問題・Menuへ渡す表示情報と操作
 * @returns 問題・Menuを表示するReact要素
 */
function ProblemMenu(props: {
    worksheet: Worksheet;
    getWorksheet: () => Worksheet;
    problem: ProblemBlock;
    index: number;
    commit: (label: string, result: WorksheetCommandResult) => void;
    close: () => void;
}) {
    let { worksheet, getWorksheet, problem, index, commit, close } = props;
    return <div className="problem-menu" onClick={(/**
     * div要素からクリック操作を受け、stop・Propagationを実行する。
     *
     * @param event 発生したイベント
     */
    function handleClick35(event) {
        return event.stopPropagation();
    })}>
    <button onClick={(/**
     * 「問題を複製」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick36() { commit("問題を複製", duplicateProblem(getWorksheet(), problem.id)); close(); })}>問題を複製</button>
    <button disabled={index === 0} onClick={(/**
     * 「上へ移動」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick37() { commit("問題を上へ移動", moveProblem(getWorksheet(), problem.id, index - 1)); close(); })}>上へ移動</button>
    <button disabled={index === worksheet.problems.length - 1} onClick={(/**
     * 「下へ移動」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick38() { commit("問題を下へ移動", moveProblem(getWorksheet(), problem.id, index + 1)); close(); })}>下へ移動</button><hr />
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.enabled} onChange={(/**
     * 入力欄から入力変更を受け、commitを実行する。
     *
     * @param event 発生したイベント
     */
    function handleChange39(event) {
        return commit("採番を切替", updateProblem(getWorksheet(), problem.id, (/**
         * 要素のnumberingの外側クリック監視を有効にするかどうかをイベントの編集操作を適用する対象のcheckedへ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateProblemCallback40(item) { item.numbering.enabled = event.target.checked; })));
    })}/>番号を付ける</label>
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.restartAt !== null} onChange={(/**
     * 入力欄から入力変更を受け、commitを実行する。
     *
     * @param event 発生したイベント
     */
    function handleChange41(event) {
        return commit("振り直しを切替", updateProblem(getWorksheet(), problem.id, (/**
         * 要素のnumberingのrestart・位置を条件に応じて選択した値へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateProblemCallback42(item) { item.numbering.restartAt = event.target.checked ? 1 : null; })));
    })}/>この項目から振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={problem.numbering.restartAt === null} value={problem.numbering.restartAt ?? 1} onChange={(/**
     * 「開始番号」入力欄から入力変更を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange43(event) {
        return commit("開始番号を変更", updateProblem(getWorksheet(), problem.id, (/**
         * 要素のnumberingのrestart・位置をmaxの結果へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateProblemCallback44(item) { item.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); })));
    })}/></label><hr />
    <button className="danger-text" disabled={worksheet.problems.length === 1} title={worksheet.problems.length === 1 ? "プリントには1問以上必要です" : undefined} onClick={(/**
     * 「問題を削除」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     */
    function handleClick45() { commit("問題を削除", deleteProblem(getWorksheet(), problem.id)); close(); })}><Trash2 size={14}/>問題を削除</button>
  </div>;
}
// --------------------
// 内容編集
// --------------------

/**
 * 本文・囲み枠・めあて・画像・表・小問・解答欄の種別に応じた編集UIを表示する。
 *
 * @param props 内容・エディタへ渡す表示情報と操作
 * @returns 内容・エディタを表示するReact要素
 */
function ContentEditor(props: {
    worksheet: Worksheet;
    getWorksheet: () => Worksheet;
    problem: ProblemBlock;
    content: ContentBlock;
    selected: boolean;
    onSelect: () => void;
    commit: (label: string, result: WorksheetCommandResult) => void;
    mutate: MutateWorksheet;
    onImage: (target: RichTextDocumentTarget) => void;
    onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void;
    onTable: (target: RichTextDocumentTarget) => void;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { worksheet, getWorksheet, problem, content, selected, onSelect, commit, mutate, onImage, onEditImage, onTable, assetUrls } = props;
    const update = (/**
     * ProseMirrorノードまたはアプリ状態の変更を既存DOMへ反映できるか判定し、可能な場合は更新する。
     *
     * @param label 画面表示やテスト識別に使う名称
     * @param change 適用する編集内容
     * @param historyGroup 同じUndo履歴へまとめる操作種別
     */
    function updateImplementation46(label: string, change: (content: Draft<ContentBlock>) => void, historyGroup?: string) {
        return mutate(label, (/**
         * mutateが渡す更新対象へ、mutateで定義した変更を反映する。
         *
         * @param draft Immerが提供する更新中の状態
         */
        function mutateCallback47(draft) {
            const targetProblem = draft.problems.find((/**
             * 要素の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する最初の要素を検索する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する場合はtrue
             */
            function findItem48(item) {
                return item.id === problem.id;
            }));
            const targetContent = targetProblem?.contents.find((/**
             * 要素の対象を一意に特定する識別子が処理対象の問題本文または解説の対象を一意に特定する識別子と一致する最初の要素を検索する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の対象を一意に特定する識別子が処理対象の問題本文または解説の対象を一意に特定する識別子と一致する場合はtrue
             */
            function findItem49(item) {
                return item.id === content.id;
            }));
            if (targetContent)
                change(targetContent);
        }), historyGroup ? { historyGroup } : undefined);
    });
    if (!selected) {
        return <section className="content-card content-card-static" role="button" tabIndex={0} aria-label="内容を編集" onKeyDown={(/**
         * 「内容を編集」要素のon・キー・Downを受け、対応する編集状態と画面表示を更新する。
         *
         * @param event 発生したイベント
         */
        function handleKeyDown50(event) {
            return activateOnKeyboard(event, onSelect);
        })} onClick={(/**
         * 「内容を編集」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
         *
         * @param event 発生したイベント
         */
        function handleClick51(event) { event.stopPropagation(); onSelect(); })}>
      <WorksheetContentPreview content={content} showAnswers subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls}/>
    </section>;
    }
    return <section className="content-card selected" onClick={(/**
     * 「上へ移動」改ページまたは表示の対象となる問題区画要素からクリック操作を受け、stop・Propagationを実行する。
     *
     * @param event 発生したイベント
     */
    function handleClick52(event) { event.stopPropagation(); onSelect(); })}>
    <div className="content-controls"><button aria-label="上へ移動" onClick={(/**
     * 「上へ移動」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick53() {
        return commit("内容を上へ移動", moveContent(getWorksheet(), problem.id, content.id, -1));
    })}>↑</button><button aria-label="下へ移動" onClick={(/**
     * 「下へ移動」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick54() {
        return commit("内容を下へ移動", moveContent(getWorksheet(), problem.id, content.id, 1));
    })}>↓</button><button className="danger-text" aria-label="削除" onClick={(/**
     * 「削除」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick55() {
        return commit("内容を削除", deleteContent(getWorksheet(), problem.id, content.id));
    })}><Trash2 size={14}/></button></div>
    {content.type === "richText" && <MixedColorDocumentEditor document={mergeColoredDocuments(content.document, content.answerDocument)} placeholder="問題文・解答を入力…" onChange={(/**
         * 「問題文・解答を入力…」Mixed・色・文書・エディタ要素から入力変更を受け、対象データへ適用する更新処理を実行する。
         *
         * @param document 処理対象のリッチテキスト文書
         */
        function handleChange56(document) {
            return update("本文を編集", (/**
             * 要素の処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback57(item) { if (item.type === "richText") {
                item.document = document;
                item.answerDocument = emptyDocument();
            } }), `richText:${problem.id}:content:${content.id}`);
        })} target={{ kind: "content", contentId: content.id }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    {content.type === "box" && <div className={`box-editor box-${content.preset}`}>
      <div className="content-setting-row"><label>囲み枠</label><input value={content.title} placeholder="題名（空欄可）" onChange={(/**
         * 「囲み枠」入力欄から入力変更を受け、対応する編集状態と画面表示を更新する。
         *
         * @param event 発生したイベント
         */
        function handleChange58(event) { const title = event.currentTarget.value; update("囲み枠の題名", (/**
         * 要素の題名をプリントまたはテストへ設定する題名へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateCallback59(item) { if (item.type === "box")
            item.title = title; }), `text:${problem.id}:content:${content.id}:title`); })}/><select value={content.preset} onChange={(/**
         * 選択欄から入力変更を受け、対象データへ適用する更新処理を実行する。
         *
         * @param event 発生したイベント
         */
        function handleChange60(event) {
            return update("囲み枠デザイン", (/**
             * 要素のpresetをイベントの編集操作を適用する対象の値へ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback61(item) { if (item.type === "box")
                item.preset = event.target.value as typeof item.preset; }));
        })}><option value="simple">シンプル</option><option value="heading">見出し付き</option><option value="band">帯見出し</option><option value="emphasis">強調</option></select></div>
      <MixedColorDocumentEditor document={mergeColoredDocuments(content.document, content.answerDocument)} placeholder="囲み枠の問題文・解答を入力…" onChange={(/**
         * 「題名（空欄可）」Mixed・色・文書・エディタ要素から入力変更を受け、対象データへ適用する更新処理を実行する。
         *
         * @param document 処理対象のリッチテキスト文書
         */
        function handleChange62(document) {
            return update("囲み枠本文を編集", (/**
             * 要素の処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback63(item) { if (item.type === "box") {
                item.document = document;
                item.answerDocument = emptyDocument();
            } }), `richText:${problem.id}:content:${content.id}`);
        })} target={{ kind: "content", contentId: content.id }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
    </div>}
    {content.type === "goal" && <div className="goal-editor">
      <div className="content-setting-row"><strong>めあて</strong><small>初期入力色は解答色（赤）です</small></div>
      <MixedColorDocumentEditor document={colorDocumentAsAnswer(content.document)} placeholder="めあてを入力…" onChange={(/**
         * 「めあてを入力…」Mixed・色・文書・エディタ要素から入力変更を受け、対象データへ適用する更新処理を実行する。
         *
         * @param document 処理対象のリッチテキスト文書
         */
        function handleChange64(document) {
            return update("めあてを編集", (/**
             * 要素の処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback65(item) { if (item.type === "goal")
                item.document = document; }), `richText:${problem.id}:content:${content.id}`);
        })} target={{ kind: "content", contentId: content.id }} initialColor="answer" assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
    </div>}
    {content.type === "answerArea" && <AnswerAreaEditor answerArea={content.answerArea} onSettingsChange={(/**
         * 画面要素から設定変更を受け、対応する編集状態と画面表示を更新する。
         *
         * @param style 表示対象へ適用する見た目の設定
         * @param rows 作成または検証する表の行数・行一覧
         */
        function handleSettingsChange66(style, rows) {
            return update("解答欄を設定", (/**
             * 要素の解答欄の表示領域を値・表示対象へ適用する見た目の設定・作成または検証する表の行数・行一覧を持つオブジェクトへ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback67(item) { if (item.type === "answerArea")
                item.answerArea = { ...item.answerArea, style, rows }; }));
        })} onChange={(/**
         * 解答・Area・エディタ要素から入力変更を受け、対象データへ適用する更新処理を実行する。
         *
         * @param document 処理対象のリッチテキスト文書
         */
        function handleChange68(document) {
            return update("解答欄を編集", (/**
             * 要素の解答欄の表示領域の処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
             *
             * @param item 配列処理で現在参照している要素
             */
            function updateCallback69(item) { if (item.type === "answerArea") {
                item.answerArea.document = document;
                item.answerArea.answerDocument = emptyDocument();
            } }), `richText:${problem.id}:content:${content.id}:answerArea`);
        })} target={{ kind: "content", contentId: content.id }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    {content.type === "spacer" && <div className="inline-content-editor"><span>スペーサー</span><label>高さ <select value={content.rows} onChange={(/**
     * 選択欄から入力変更を受け、対象データへ適用する更新処理を実行する。
     *
     * @param event 発生したイベント
     */
    function handleChange70(event) {
        return update("スペーサーを設定", (/**
         * 要素の作成または検証する表の行数・行一覧を番号の結果へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateCallback71(item) { if (item.type === "spacer")
            item.rows = Number(event.target.value); }));
    })}>{Array.from({ length: 20 }, (/**
     * 配列位置ごとに画面表示用のReact要素を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param index 対象となる位置
     * @returns fromを表示するReact要素
     */
    function fromCallback72(_, index) {
        return <option value={index + 1} key={index + 1}>{index + 1}</option>;
    }))}</select> 行</label></div>}
    {content.type === "pageBreak" && <div className="page-break-editor"><span><Scissors size={15}/>ここで改ページ</span></div>}
    {content.type === "image" && <div className="image-content-editor">{assetUrls.get(content.assetId) ? <img src={assetUrls.get(content.assetId)} alt={content.alt}/> : <span className="image-content-missing">画像を読み込めません</span>}<div><strong>画像</strong><span>配置: {{ block: "独立", floatLeft: "左回り込み", floatRight: "右回り込み" }[content.placement]}</span><span>サイズ: {content.widthPercent}%</span></div><button type="button" className="small-button" onClick={(/**
     * 「画像を編集」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick73() {
        return onEditImage(null, { id: content.id, assetId: content.assetId, alt: content.alt, placement: content.placement, widthPercent: content.widthPercent, answerColor: false });
    })}><Pencil size={13}/>画像を編集</button></div>}
    {content.type === "table" && <TableEditor content={content} onChange={(/**
     * 表・エディタ要素から入力変更を受け、対象データへ適用する更新処理を実行する。
     *
     * @param table 編集または検証の対象となる表
     * @param historyGroup 同じUndo履歴へまとめる操作種別
     */
    function handleChange74(table, historyGroup) {
        return update("表を編集", (/**
         * 要素の作成または検証する表の行数・行一覧を編集または検証の対象となる表の作成または検証する表の行数・行一覧へ更新する。
         *
         * @param item 配列処理で現在参照している要素
         */
        function updateCallback75(item) { if (item.type === "table") {
            item.rows = table.rows;
            item.columnWidthsPercent = table.columnWidthsPercent;
        } }), historyGroup);
    })}/>}
    {content.type === "subQuestionGroup" && <SubQuestionEditor worksheet={worksheet} getWorksheet={getWorksheet} problem={problem} content={content} commit={commit} mutate={mutate} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
  </section>;
}

// --------------------
// リッチテキスト編集
// --------------------

type MixedColorDocumentEditorProps = {
    document: BasicRichTextDocument;
    placeholder: string;
    onChange: (document: BasicRichTextDocument) => void;
    target: RichTextDocumentTarget;
    compact?: boolean;
    initialColor?: ContentColor;
    assetUrls: ReadonlyMap<string, string>;
    onImage: (target: RichTextDocumentTarget) => void;
    onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void;
    onTable: (target: RichTextDocumentTarget) => void;
};
/**
 * 編集操作を適用する対象と文字または数式へ適用する色を基に対象・With・色を導出する。
 *
 * @param target 編集操作を適用する対象
 * @param color 文字または数式へ適用する色
 * @returns 条件に応じて選択した値
 */
function targetWithColor(target: RichTextDocumentTarget, color: ContentColor): RichTextDocumentTarget {
    return target.kind === "solution" ? target : { ...target, color };
}
/**
 * 問題色と解答色を切り替えながら編集できるリッチテキスト入力欄を表示する。
 *
 * @param props Mixed・色・文書・エディタへ渡す表示情報と操作
 * @returns Mixed・色・文書・エディタを表示するReact要素
 */
function MixedColorDocumentEditor(props: MixedColorDocumentEditorProps) {
    return <RichTextEditor compact={Boolean(props.compact)} document={props.document} assetUrls={props.assetUrls} placeholder={props.placeholder} onChange={props.onChange} initialColor={props.initialColor ?? "problem"} enableMath onImage={(/**
     * 画面要素から画像挿入要求を受け、対応する編集状態と画面表示を更新する。
     *
     * @param color 文字または数式へ適用する色
     */
    function handleImage76(color) {
        return props.onImage(targetWithColor(props.target, color));
    })} onEditImage={(/**
     * 画面要素から画像編集要求を受け、対応する編集状態と画面表示を更新する。
     *
     * @param image 表示または編集する画像
     */
    function handleEditImage77(image) {
        return props.onEditImage(targetWithColor(props.target, image.answerColor ? "answer" : "problem"), image);
    })} onTable={(/**
     * 画面要素から表挿入要求を受け、対応する編集状態と画面表示を更新する。
     *
     * @param color 文字または数式へ適用する色
     */
    function handleTable78(color) {
        return props.onTable(targetWithColor(props.target, color));
    })}/>;
}
// --------------------
// 解答欄
// --------------------

/**
 * 解答欄の種類・行数・幅など、生徒が記入する領域の設定UIを表示する。
 *
 * @param props 解答・Area・エディタへ渡す表示情報と操作
 * @returns 解答・Area・エディタを表示するReact要素
 */
function AnswerAreaEditor(props: {
    answerArea: AnswerArea;
    onSettingsChange: (style: "lines" | "box", rows: number) => void;
    onChange: (document: BasicRichTextDocument) => void;
    target: RichTextDocumentTarget;
    assetUrls: ReadonlyMap<string, string>;
    onImage: (target: RichTextDocumentTarget) => void;
    onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void;
    onTable: (target: RichTextDocumentTarget) => void;
}) {
    let { answerArea, onSettingsChange, onChange, target, assetUrls, onImage, onEditImage, onTable } = props;
    return <div className="answer-area-editor">
    <div className="inline-content-editor answer-area-settings"><strong>生徒用解答欄</strong><label>種類 <select value={answerArea.style} onChange={(/**
     * 「横罫線」選択欄から入力変更を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange79(event) {
        return onSettingsChange(event.target.value as "lines" | "box", answerArea.rows);
    })}><option value="lines">横罫線</option><option value="box">四角囲み</option></select></label><label>高さ <select value={answerArea.rows} onChange={(/**
     * 選択欄から入力変更を受け、on・設定・Changeとして親コンポーネントへ通知する。
     *
     * @param event 発生したイベント
     */
    function handleChange80(event) {
        return onSettingsChange(answerArea.style, Number(event.target.value));
    })}>{Array.from({ length: 20 }, (/**
     * 配列位置ごとに画面表示用のReact要素を生成し、fixtureまたはバイナリの要素として格納する。
     *
     * @param _ コールバックの契約上受け取るが、この処理では参照しない未使用の入力
     * @param index 対象となる位置
     * @returns fromを表示するReact要素
     */
    function fromCallback81(_, index) {
        return <option value={index + 1} key={index + 1}>{index + 1}</option>;
    }))}</select> 行</label></div>
    <MixedColorDocumentEditor document={mergeColoredDocuments(answerArea.document, answerArea.answerDocument)} placeholder="解答欄の問題文・解答を入力…" onChange={onChange} target={target} compact assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
  </div>;
}
// --------------------
// 小問編集
// --------------------

/**
 * 小問の追加・採番・本文・解説・並べ替えを一つの編集領域として表示する。
 *
 * @param props Sub・Question・エディタへ渡す表示情報と操作
 * @returns Sub・Question・エディタを表示するReact要素
 */
function SubQuestionEditor(props: {
    worksheet: Worksheet;
    getWorksheet: () => Worksheet;
    problem: ProblemBlock;
    content: Extract<ContentBlock, {
        type: "subQuestionGroup";
    }>;
    commit: (label: string, result: WorksheetCommandResult) => void;
    mutate: MutateWorksheet;
    assetUrls: ReadonlyMap<string, string>;
    onImage: (target: RichTextDocumentTarget) => void;
    onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void;
    onTable: (target: RichTextDocumentTarget) => void;
}) {
    let { worksheet, getWorksheet, problem, content, commit, mutate, assetUrls, onImage, onEditImage, onTable } = props;
    const [menuItemId, setMenuItemId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const numbers = getSubQuestionNumbers(content, worksheet.pageSettings.subQuestionNumberFormat);
    const updateItem = (/**
     * 要素を現在の編集結果へ反映する。
     *
     * @param label 画面表示やテスト識別に使う名称
     * @param itemId 対象を識別するID
     * @param change 適用する編集内容
     * @param historyGroup 同じUndo履歴へまとめる操作種別
     */
    function updateItemImplementation82(label: string, itemId: string, change: (item: Draft<(typeof content.items)[number]>) => void, historyGroup?: string) {
        return mutate(label, (/**
         * mutateが渡す更新対象へ、mutateで定義した変更を反映する。
         *
         * @param draft Immerが提供する更新中の状態
         */
        function mutateCallback83(draft) {
            const targetProblem = draft.problems.find((/**
             * キーと値の組の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する最初の要素を検索する。
             *
             * @param entry キーと値の組
             * @returns キーと値の組の対象を一意に特定する識別子が処理対象の問題または例題の対象を一意に特定する識別子と一致する場合はtrue
             */
            function findItem84(entry) {
                return entry.id === problem.id;
            }));
            const targetGroup = targetProblem?.contents.find((/**
             * キーと値の組の対象を一意に特定する識別子が処理対象の問題本文または解説の対象を一意に特定する識別子と一致する最初の要素を検索する。
             *
             * @param entry キーと値の組
             * @returns キーと値の組の対象を一意に特定する識別子が処理対象の問題本文または解説の対象を一意に特定する識別子と一致する場合はtrue
             */
            function findItem85(entry) {
                return entry.id === content.id;
            }));
            if (targetGroup?.type !== "subQuestionGroup")
                return;
            const targetItem = targetGroup.items.find((/**
             * キーと値の組の対象を一意に特定する識別子が要素・Idと一致する最初の要素を検索する。
             *
             * @param entry キーと値の組
             * @returns キーと値の組の対象を一意に特定する識別子が要素・Idと一致する場合はtrue
             */
            function findItem86(entry) {
                return entry.id === itemId;
            }));
            if (targetItem)
                change(targetItem);
        }), historyGroup ? { historyGroup } : undefined);
    });
    useOutsidePointerDown(menuRef, menuItemId !== null, (/**
     * Menu・要素・識別子をユーザー操作または非同期処理の結果に合わせて更新する。
     */
    function useOutsidePointerDownCallback87() {
        return setMenuItemId(null);
    }));
    return <div className="subquestion-editor">
    <div className="subquestion-title">小問</div>
    <div className="subquestion-grid">{content.items.map((/**
         * 各要素を画面表示用のReact要素へ変換する。
         *
         * @param item 配列処理で現在参照している要素
         * @returns 画面表示用のReact要素
         */
        function mapItem88(item) {
            return <article className={item.width === "full" ? "subquestion-card full" : "subquestion-card"} key={item.id}>
      <header>
        <span><GripVertical size={14}/>{numbers.get(item.id)}{item.numbering.restartAt !== null && <span className="status-chip">{item.numbering.restartAt}から再開</span>}</span>
        <select value={item.width} onChange={(/**
             * 選択欄から入力変更を受け、更新・要素を実行する。
             *
             * @param event 発生したイベント
             */
            function handleChange89(event) {
                return updateItem("小問幅を変更", item.id, (/**
                 * キーと値の組の要素または列へ適用する幅をイベントの編集操作を適用する対象の値へ更新する。
                 *
                 * @param entry キーと値の組
                 */
                function updateItemCallback90(entry) { entry.width = event.target.value as typeof entry.width; }));
            })}><option value="column">半幅</option><option value="full">全幅</option></select>
        <div className="relative" ref={menuItemId === item.id ? menuRef : undefined}>
          <button className="icon-button" aria-label="小問設定" onClick={(/**
             * 「小問設定」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
             */
            function handleClick91() {
                return setMenuItemId(menuItemId === item.id ? null : item.id);
            })}><MoreHorizontal size={14}/></button>
          {menuItemId === item.id && <SubQuestionMenu getWorksheet={getWorksheet} problem={problem} groupId={content.id} item={item} commit={commit}/>}
        </div>
        <button className="icon-button" disabled={content.items.length <= 1} aria-label="小問を削除" onClick={(/**
             * 「小問を削除」要素のon・Clickを受け、対応する編集状態と画面表示を更新する。
             *
             */
            function handleClick92() {
                return commit("小問を削除", deleteSubQuestion(getWorksheet(), problem.id, content.id, item.id));
            })}><Trash2 size={14}/></button>
      </header>
      <MixedColorDocumentEditor compact document={mergeColoredDocuments(item.content, item.answerContent)} placeholder="小問の問題文・解答を入力…" onChange={(/**
             * Mixed・色・文書・エディタ要素から入力変更を受け、更新・要素を実行する。
             *
             * @param document 処理対象のリッチテキスト文書
             */
            function handleChange93(document) {
                return updateItem("小問を編集", item.id, (/**
                 * キーと値の組の内容を処理対象のリッチテキスト文書へ更新する。
                 *
                 * @param entry キーと値の組
                 */
                function updateItemCallback94(entry) { entry.content = document; entry.answerContent = emptyDocument(); }), `richText:${problem.id}:subQuestion:${content.id}:${item.id}:content`);
            })} target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "content" }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
      {item.answerArea && <AnswerAreaEditor answerArea={item.answerArea} onSettingsChange={(/**
                 * 画面要素から設定変更を受け、対応する編集状態と画面表示を更新する。
                 *
                 * @param style 表示対象へ適用する見た目の設定
                 * @param rows 作成または検証する表の行数・行一覧
                 */
                function handleSettingsChange95(style, rows) {
                    return updateItem("小問解答欄を設定", item.id, (/**
                     * キーと値の組の解答欄の表示領域を値・表示対象へ適用する見た目の設定・作成または検証する表の行数・行一覧を持つオブジェクトへ更新する。
                     *
                     * @param entry キーと値の組
                     */
                    function updateItemCallback96(entry) { if (entry.answerArea)
                        entry.answerArea = { ...entry.answerArea, style, rows }; }));
                })} onChange={(/**
                 * 解答・Area・エディタ要素から入力変更を受け、更新・要素を実行する。
                 *
                 * @param document 処理対象のリッチテキスト文書
                 */
                function handleChange97(document) {
                    return updateItem("小問解答欄を編集", item.id, (/**
                     * キーと値の組の解答欄の表示領域の処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
                     *
                     * @param entry キーと値の組
                     */
                    function updateItemCallback98(entry) { if (entry.answerArea) {
                        entry.answerArea.document = document;
                        entry.answerArea.answerDocument = emptyDocument();
                    } }), `richText:${problem.id}:subQuestion:${content.id}:${item.id}:answerArea`);
                })} target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "answerArea" }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    </article>;
        }))}</div>
    <button className="small-button" disabled={content.items.length >= 100} onClick={(/**
     * 「小問を追加」ボタンからクリック操作を受け、対応する編集状態と画面表示を更新する。
     *
     */
    function handleClick99() {
        return commit("小問を追加", addSubQuestion(getWorksheet(), problem.id, content.id));
    })}><Plus size={14}/>小問を追加</button>
  </div>;
}
/**
 * 小問の種類変更・移動・削除操作を表示する。
 *
 * @param props Sub・Question・Menuへ渡す表示情報と操作
 * @returns Sub・Question・Menuを表示するReact要素
 */
function SubQuestionMenu(props: {
    getWorksheet: () => Worksheet;
    problem: ProblemBlock;
    groupId: string;
    item: Extract<ContentBlock, {
        type: "subQuestionGroup";
    }>["items"][number];
    commit: (label: string, result: WorksheetCommandResult) => void;
}) {
    let { getWorksheet, problem, groupId, item, commit } = props;
    return <div className="problem-menu subquestion-menu" onClick={(/**
     * div要素からクリック操作を受け、stop・Propagationを実行する。
     *
     * @param event 発生したイベント
     */
    function handleClick100(event) {
        return event.stopPropagation();
    })}>
    <label className="menu-check"><input type="checkbox" checked={item.numbering.restartAt !== null} onChange={(/**
     * 入力欄から入力変更を受け、commitを実行する。
     *
     * @param event 発生したイベント
     */
    function handleChange101(event) {
        return commit("小問の振り直しを切替", updateSubQuestion(getWorksheet(), problem.id, groupId, item.id, (/**
         * キーと値の組のnumberingのrestart・位置を条件に応じて選択した値へ更新する。
         *
         * @param entry キーと値の組
         */
        function updateSubQuestionCallback102(entry) { entry.numbering.restartAt = event.target.checked ? 1 : null; })));
    })}/>この小問から番号を振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={item.numbering.restartAt === null} value={item.numbering.restartAt ?? 1} onChange={(/**
     * 「開始番号」入力欄から入力変更を受け、対応する編集状態と画面表示を更新する。
     *
     * @param event 発生したイベント
     */
    function handleChange103(event) {
        return commit("小問の開始番号を変更", updateSubQuestion(getWorksheet(), problem.id, groupId, item.id, (/**
         * キーと値の組のnumberingのrestart・位置をmaxの結果へ更新する。
         *
         * @param entry キーと値の組
         */
        function updateSubQuestionCallback104(entry) { entry.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); })));
    })}/></label>
  </div>;
}
// --------------------
// 表編集
// --------------------

/**
 * 表セルの本文と行高・列幅・行列追加削除を編集するUIを表示する。
 *
 * @param props 表・エディタへ渡す表示情報と操作
 * @returns 表・エディタを表示するReact要素
 */
function TableEditor(props: {
    content: Extract<ContentBlock, {
        type: "table";
    }>;
    onChange: (table: EditableTableData, historyGroup?: string) => void;
}) {
    let { content, onChange } = props;
    const [activeCellId, setActiveCellId] = useState<string | null>((/**
     * 初回描画でだけ必要な初期状態を生成し、その後の再描画では同じ値を保持する。
     *
     * @returns 二つの値を比較した結果
     */
    function useStateCallback105() {
        return content.rows[0]?.cells[0]?.id ?? null;
    }));
    const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
    const tableData: EditableTableData = { rows: content.rows, columnWidthsPercent: content.columnWidthsPercent };
    const resolvedActiveCellId = activeCellId && getTableCellLocation(tableData, activeCellId)
        ? activeCellId
        : (content.rows[0]?.cells[0]?.id ?? null);
    const availability = resolvedActiveCellId ? getTableOperationAvailability(tableData, resolvedActiveCellId) : null;
    const activeLocation = resolvedActiveCellId ? getTableCellLocation(tableData, resolvedActiveCellId) : null;
    const updateCell = (/**
     * 処理対象の表セルの処理対象のリッチテキスト文書を処理対象のリッチテキスト文書へ更新する。
     *
     * @param cellId 対象を識別するID
     * @param document 処理対象のリッチテキスト文書
     */
    function updateCellImplementation106(cellId: string, document: typeof content.rows[number]["cells"][number]["document"]) {
        const rows = structuredClone(content.rows);
        for (const row of rows) {
            const cell = row.cells.find((/**
             * 要素の対象を一意に特定する識別子がセル・Idと一致する最初の要素を検索する。
             *
             * @param item 配列処理で現在参照している要素
             * @returns 要素の対象を一意に特定する識別子がセル・Idと一致する場合はtrue
             */
            function findItem107(item) {
                return item.id === cellId;
            }));
            if (cell) {
                cell.document = document;
                onChange({ rows, columnWidthsPercent: content.columnWidthsPercent }, `richText:table-cell:${content.id}:${cellId}`);
                return;
            }
        }
    });
    const operate = (/**
     * operateを適用・表・Operationで処理し、その結果を呼び出し元へ反映する。
     *
     * @param operation 計測または適用する操作
     */
    function operateImplementation108(operation: TableOperation) {
        if (!resolvedActiveCellId)
            return;
        const result = applyTableOperation(tableData, resolvedActiveCellId, operation);
        if (!result)
            return;
        setActiveCellId(result.activeCellId);
        onChange({ rows: result.rows, columnWidthsPercent: result.columnWidthsPercent });
    });
    const setRowHeight = (/**
     * 表・行・高さをユーザー操作または非同期処理の結果に合わせて更新する。
     *
     * @param heightMm ミリメートル単位の高さ
     */
    function setRowHeightImplementation109(heightMm: number | null) {
        if (!activeLocation)
            return;
        const result = setTableRowHeight(tableData, activeLocation.row, heightMm);
        if (result)
            onChange(result);
    });
    const setColumnWidth = (/**
     * 表・列・幅をユーザー操作または非同期処理の結果に合わせて更新する。
     *
     * @param widthPercent 表全体に対する列幅の割合
     */
    function setColumnWidthImplementation110(widthPercent: number) {
        if (!activeLocation)
            return;
        const result = setTableColumnWidth(tableData, activeLocation.column, widthPercent);
        if (result)
            onChange(result);
    });
    return <div className="table-content-editor">
    <div className="content-setting-row"><strong>表</strong><span>{content.rows.length}行 × {content.columnWidthsPercent.length}列</span><small>セルにカーソルを置き、上の∑から数式を挿入できます</small></div>
    {availability && activeLocation && <TableStructureToolbar availability={availability} onOperation={operate} sizing={{
                rowHeightMm: content.rows[activeLocation.row]?.heightMm ?? null,
                columnWidthPercent: content.columnWidthsPercent[activeLocation.column] ?? 100,
                canResizeColumn: content.columnWidthsPercent.length > 1,
                onRowHeightChange: setRowHeight,
                onColumnWidthChange: setColumnWidth,
            }}/>}
    <div className="table-cell-toolbar-host" ref={setToolbarContainer}/>
    <table><colgroup>{content.columnWidthsPercent.map((/**
     * 各要素または列へ適用する幅を画面表示用のReact要素へ変換する。
     *
     * @param width 要素または列へ適用する幅
     * @param index 対象となる位置
     * @returns 画面表示用のReact要素
     */
    function mapItem111(width, index) {
        return <col key={index} style={{ width: `${width}%` }}/>;
    }))}</colgroup><tbody>{content.rows.map((/**
         * 各処理対象の表の行を画面表示用のReact要素へ変換する。
         *
         * @param row 処理対象の表の行
         * @param rowIndex 表内での行位置
         * @returns 画面表示用のReact要素
         */
        function mapItem112(row, rowIndex) {
            return <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((/**
                 * 各処理対象の表セルを画面表示用のReact要素へ変換する。
                 *
                 * @param cell 処理対象の表セル
                 * @returns 画面表示用のReact要素
                 */
                function mapItem113(cell) {
                    const Cell = content.headerRow && rowIndex === 0 ? "th" : "td";
                    const location = getTableCellLocation(tableData, cell.id);
                    const logicalColumn = location?.column ?? 0;
                    return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan} className={resolvedActiveCellId === cell.id ? "active" : ""}>
        {resolvedActiveCellId === cell.id
                            ? <RichTextEditor tableCell compact toolbarContainer={toolbarContainer} document={cell.document} placeholder={`${rowIndex + 1}行${logicalColumn + 1}列`} onChange={(/**
                             * リッチ・テキスト・エディタ要素から入力変更を受け、更新・セルを実行する。
                             *
                             * @param document 処理対象のリッチテキスト文書
                             */
                            function handleChange114(document) {
                                return updateCell(cell.id, document as typeof cell.document);
                            })}/>
                            : <button type="button" className="table-cell-select" aria-label={`${rowIndex + 1}行${logicalColumn + 1}列を編集`} onClick={(/**
                             * ボタンからクリック操作を受け、有効状態・セル・識別子を操作内容に合う状態へ更新する。
                             */
                            function handleClick115() {
                                return setActiveCellId(cell.id);
                            })}><TableCellDocumentPreview document={cell.document}/></button>}
      </Cell>;
                }))}</tr>;
        }))}</tbody></table>
  </div>;
}
// --------------------
// 補助表示
// --------------------

/**
 * 非編集中の表セル文書を文字装飾と数式を保ったまま表示する。
 *
 * @param props 表・セル・文書・プレビューへ渡す表示情報と操作
 * @returns 表・セル・文書・プレビューを表示するReact要素
 */
function TableCellDocumentPreview(props: {
    document: Extract<ContentBlock, {
        type: "table";
    }>["rows"][number]["cells"][number]["document"];
}) {
    let { document } = props;
    const visible = document.content.some((/**
     * いずれかのノードが要求条件を満たすか判定する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @returns ノードの作成または検証する要素種別が「imageRef」と一致するまたはノードの処理対象の問題本文または解説のlengthが0より大きい場合はtrue
     */
    function hasMatchingItem116(node) {
        return node.type === "imageRef" || node.content.length > 0;
    }));
    if (!visible)
        return <span className="table-cell-empty">空のセル</span>;
    return <>{document.content.map((/**
         * 各ノードを条件に応じて選択した値へ変換する。
         *
         * @param node 走査または変換するリッチテキストノード
         * @param blockIndex 対象ブロックの位置
         * @returns 条件に応じて選択した値
         */
        function mapItem117(node, blockIndex) {
            return node.type === "imageRef"
                ? <span className={node.attrs.answerColor ? "answer-color" : undefined} key={blockIndex}>[画像]</span>
                : <span className="table-cell-preview-paragraph" key={blockIndex}>{node.content.map((/**
                 * 各走査中の子ノードを画面表示用のReact要素へ変換する。
                 *
                 * @param child 走査中の子ノード
                 * @param childIndex 親ノード内での子要素の位置
                 * @returns 画面表示用のReact要素
                 */
                function mapItem118(child, childIndex) {
                    return <span key={childIndex}>{renderTableCellInline(child)}</span>;
                }))}</span>;
        }))}</>;
}
type TableCellInlineNode = Extract<TableCellRichTextDocument["content"][number], {
    type: "paragraph";
}>["content"][number];
/**
 * renderedを画面表示用のReact要素へ更新する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns render・表・セル・Inlineを表示するReact要素
 */
function renderTableCellInline(node: TableCellInlineNode): ReactNode {
    if (node.type === "hardBreak")
        return <br />;
    if (node.type === "inlineMath")
        return <span className={node.attrs.answerColor ? "answer-color" : undefined}><MathFormula latex={node.attrs.latex} textSize={node.attrs.textSize}/></span>;
    let rendered: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
        if (mark.type === "bold")
            rendered = <strong>{rendered}</strong>;
        else if (mark.type === "underline")
            rendered = <u>{rendered}</u>;
        else if (mark.type === "italic")
            rendered = <em>{rendered}</em>;
        else if (mark.type === "textSize")
            rendered = <span className={`text-size-${mark.attrs.size}`}>{rendered}</span>;
        else if (mark.type === "answerColor")
            rendered = <span className="answer-color">{rendered}</span>;
    }
    return rendered;
}
