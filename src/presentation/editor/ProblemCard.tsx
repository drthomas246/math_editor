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
/**
 * activateOnKeyboardに必要な処理を実行する。
 *
 * @param event 発生したイベント
 * @param action actionとして使用する値
 */
function activateOnKeyboard(event: KeyboardEvent<HTMLElement>, action: () => void) {
    if (event.key !== "Enter" && event.key !== " ")
        return;
    event.preventDefault();
    event.stopPropagation();
    action();
}
/**
 * ProblemCardコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ProblemCard(props: Props) {
    const { worksheet, getWorksheet, problem, index, displayNumber, selected, selectedContentId, onSelect, onSelectContent, onCommit, onMutate, onAddImage, onUpdateImage, assetUrls, onToast } = props;
    const readWorksheet = (/**
     * readWorksheetで必要な値を取得する。
     *
     * @returns 呼び出し元で使用する処理結果
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
     * useOutsidePointerDownへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useOutsidePointerDownCallback2() {
        return setProblemMenu(false);
    }));
    useOutsidePointerDown(addMenuRef, addMenu, (/**
     * useOutsidePointerDownへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useOutsidePointerDownCallback3() {
        return setAddMenu(false);
    }));
    const commit = (/**
     * commitの対象となる状態を更新する。
     *
     * @param label labelとして使用する値
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
     * addBlockの対象となる要素を追加する。
     *
     * @param type typeとして使用する値
     */
    function addBlockImplementation5(type: AddContentType) {
        const content = createContentBlock(type);
        commit("内容を追加", addContent(readWorksheet(), problem.id, content, selectedContentId));
        onSelectContent(content.id);
        setAddMenu(false);
    });
    const solutionSelected = selected && selectedContentId === null;
    const toggleSolution = (/**
     * toggleSolutionに対応する画面表示を更新する。
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
     * selectSolutionで必要な値を取得する。
     */
    function selectSolutionImplementation7() {
        onSelect();
        onSelectContent(null);
    });
    return <article className={selected ? "problem-card selected" : "problem-card"} data-editor-problem-id={problem.id} onClick={onSelect}>
    <header className="problem-card-header">
      <div className="problem-title"><span className="drag-handle" aria-hidden="true"><GripVertical size={18}/></span><select className="problem-kind-select" aria-label="問題の種類" value={problem.kind} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick8(event) {
        return event.stopPropagation();
    })} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange9(event) {
        return commit("問題の種類を変更", updateProblem(readWorksheet(), problem.id, (/**
         * updateProblemへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateProblemCallback10(item) { item.kind = event.target.value as typeof item.kind; })));
    })}><option value="problem">問題</option><option value="example">例題</option></select><span>{displayNumber ? displayNumber.replace(/[^0-9]/gu, "") || displayNumber : "番号なし"}</span>{problem.numbering.restartAt && <span className="status-chip">{problem.numbering.restartAt}から再開</span>}</div>
      <div className="problem-actions"><button className="small-button" disabled={worksheet.problems.length >= 200} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleClick11(event) { event.stopPropagation(); commit("問題を複製", duplicateProblem(readWorksheet(), problem.id)); })}><Copy size={14}/>複製</button><div className="relative" ref={problemMenuRef}><button className="icon-button" aria-label="問題設定" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleClick12(event) { event.stopPropagation(); setProblemMenu(!problemMenu); })}><MoreHorizontal size={18}/></button>{problemMenu && <ProblemMenu worksheet={worksheet} getWorksheet={readWorksheet} problem={problem} index={index} commit={commit} close={(/**
     * closeで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function closeCallback13() {
        return setProblemMenu(false);
    })}/>}</div></div>
    </header>
    <div className="content-list">
      {problem.contents.length === 0 && <div className="empty-problem"><p>{problem.kind === "example" ? "例題" : "問題"}{displayNumber ?? ""}には内容がありません。</p><span>「内容を追加」から編集を再開できます。</span></div>}
      {problem.contents.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param content contentとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem14(content) {
        return <ContentEditor key={content.id} worksheet={worksheet} getWorksheet={readWorksheet} problem={problem} content={content} selected={selected && selectedContentId === content.id} onSelect={(/**
         * onSelectで発生した画面イベントを処理する。
         */
        function handleSelect15() { onSelect(); onSelectContent(content.id); })} commit={commit} mutate={onMutate} assetUrls={assetUrls} onImage={(/**
         * onImageで発生した画面イベントを処理する。
         *
         * @param target targetとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleImage16(target) {
            return setImageDialog({ mode: "insert", target });
        })} onEditImage={(/**
         * onEditImageで発生した画面イベントを処理する。
         *
         * @param target targetとして使用する値
         * @param image imageとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleEditImage17(target, image) {
            return setImageDialog({ mode: "edit", target, image });
        })} onTable={setTableTarget}/>;
    }))}
    </div>
    <div className="solution-section">
      <button className="solution-toggle" aria-expanded={solutionOpen} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleClick18(event) { event.stopPropagation(); toggleSolution(); })}>{solutionOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}教師用の解説{problem.solution && <span className="status-chip">入力済み</span>}</button>
      {solutionOpen && (solutionSelected
            ? <div className="solution-editor"><label>解説</label><RichTextEditor document={(problem.solution ?? emptySolutionDocument()) as never} assetUrls={assetUrls} onChange={(/**
                 * onChangeで発生した画面イベントを処理する。
                 *
                 * @param document documentとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleChange19(document) {
                    return onMutate("教師用の解説を編集", (/**
                     * onMutateへ渡す処理を実行する。
                     *
                     * @param draft draftとして使用する値
                     */
                    function onMutateCallback20(draft) {
                        const target = draft.problems.find((/**
                         * 検索条件に一致する要素か判定する。
                         *
                         * @param item 処理対象の値
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function findItem21(item) {
                            return item.id === problem.id;
                        }));
                        if (target)
                            target.solution = document as never;
                    }), { historyGroup: `richText:${problem.id}:solution` });
                })} enableMath showColorSelector={false} onImage={(/**
             * onImageで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleImage22() {
                return setImageDialog({ mode: "insert", target: { kind: "solution" } });
            })} onEditImage={(/**
             * onEditImageで発生した画面イベントを処理する。
             *
             * @param image imageとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function handleEditImage23(image) {
                return setImageDialog({ mode: "edit", target: { kind: "solution" }, image });
            })} onTable={(/**
             * onTableで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleTable24() {
                return setTableTarget({ kind: "solution" });
            })}/></div>
            : <div className="solution-editor solution-editor-static" role="button" tabIndex={0} aria-label="教師用の解説を編集" onKeyDown={(/**
             * onKeyDownで発生した画面イベントを処理する。
             *
             * @param event 発生したイベント
             * @returns 呼び出し元で使用する処理結果
             */
            function handleKeyDown25(event) {
                return activateOnKeyboard(event, selectSolution);
            })} onClick={(/**
             * onClickで発生した画面イベントを処理する。
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
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleClick27(event) { event.stopPropagation(); setAddMenu(!addMenu); })}><Plus size={16}/>内容を追加</button>{addMenu && <div className="add-content-popover"><strong>追加する内容</strong><div>{ADD_CONTENT_OPTIONS.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param parameter1 parameter1として使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem28(parameter1) {
        let [type, label] = parameter1;
        return <button key={type} onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         */
        function handleClick29(event) { event.stopPropagation(); addBlock(type); })}>{label}</button>;
    }))}</div></div>}</div>
    {tableTarget !== undefined && <TableDialog onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose30() {
            return setTableTarget(undefined);
        })} onInsert={(/**
             * onInsertで発生した画面イベントを処理する。
             *
             * @param table tableとして使用する値
             */
            function handleInsert31(table) {
                if (tableTarget === null) {
                    commit("表を挿入", addContent(readWorksheet(), problem.id, table, selectedContentId));
                    onSelectContent(table.id);
                }
                else {
                    commit("表を挿入", updateRichTextDocument(readWorksheet(), problem.id, tableTarget, (/**
                     * updateRichTextDocumentへ渡す処理を実行する。
                     *
                     * @param document documentとして使用する値
                     */
                    function updateRichTextDocumentCallback32(document) {
                        document.content.push({ type: "richTable", attrs: { id: table.id, rows: table.rows, columnWidthsPercent: table.columnWidthsPercent, headerRow: table.headerRow, answerColor: tableTarget.kind !== "solution" && tableTarget.color === "answer" } });
                    })));
                    onSelectContent(tableTarget.kind === "content" ? tableTarget.contentId : tableTarget.kind === "subQuestion" ? tableTarget.groupId : null);
                }
                setTableTarget(undefined);
            })}/>}
    {imageDialog && <ImageDialog worksheetId={worksheet.id} {...(imageDialog.mode === "edit" ? { initial: { placement: imageDialog.image.placement, widthPercent: imageDialog.image.widthPercent, alt: imageDialog.image.alt, ...(assetUrls.get(imageDialog.image.assetId) ? { previewUrl: assetUrls.get(imageDialog.image.assetId)! } : {}) } } : {})} onClose={(/**
         * onCloseで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleClose33() {
            return setImageDialog(null);
        })} onApply={(/**
             * onApplyで発生した画面イベントを処理する。
             *
             * @param asset assetとして使用する値
             * @param placement placementとして使用する値
             * @param width widthとして使用する値
             * @param alt altとして使用する値
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
type ImageDialogState = {
    mode: "insert";
    target: RichTextDocumentTarget | null;
} | {
    mode: "edit";
    target: RichTextDocumentTarget | null;
    image: EditableImageRef;
};
/**
 * ProblemMenuコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick35(event) {
        return event.stopPropagation();
    })}>
    <button onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick36() { commit("問題を複製", duplicateProblem(getWorksheet(), problem.id)); close(); })}>問題を複製</button>
    <button disabled={index === 0} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick37() { commit("問題を上へ移動", moveProblem(getWorksheet(), problem.id, index - 1)); close(); })}>上へ移動</button>
    <button disabled={index === worksheet.problems.length - 1} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick38() { commit("問題を下へ移動", moveProblem(getWorksheet(), problem.id, index + 1)); close(); })}>下へ移動</button><hr />
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.enabled} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange39(event) {
        return commit("採番を切替", updateProblem(getWorksheet(), problem.id, (/**
         * updateProblemへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateProblemCallback40(item) { item.numbering.enabled = event.target.checked; })));
    })}/>番号を付ける</label>
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.restartAt !== null} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange41(event) {
        return commit("振り直しを切替", updateProblem(getWorksheet(), problem.id, (/**
         * updateProblemへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateProblemCallback42(item) { item.numbering.restartAt = event.target.checked ? 1 : null; })));
    })}/>この項目から振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={problem.numbering.restartAt === null} value={problem.numbering.restartAt ?? 1} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange43(event) {
        return commit("開始番号を変更", updateProblem(getWorksheet(), problem.id, (/**
         * updateProblemへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateProblemCallback44(item) { item.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); })));
    })}/></label><hr />
    <button className="danger-text" disabled={worksheet.problems.length === 1} title={worksheet.problems.length === 1 ? "プリントには1問以上必要です" : undefined} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     */
    function handleClick45() { commit("問題を削除", deleteProblem(getWorksheet(), problem.id)); close(); })}><Trash2 size={14}/>問題を削除</button>
  </div>;
}
/**
 * ContentEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * updateの対象となる状態を更新する。
     *
     * @param label labelとして使用する値
     * @param change changeとして使用する値
     * @param historyGroup historyGroupとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function updateImplementation46(label: string, change: (content: Draft<ContentBlock>) => void, historyGroup?: string) {
        return mutate(label, (/**
         * mutateへ渡す処理を実行する。
         *
         * @param draft draftとして使用する値
         */
        function mutateCallback47(draft) {
            const targetProblem = draft.problems.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem48(item) {
                return item.id === problem.id;
            }));
            const targetContent = targetProblem?.contents.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
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
         * onKeyDownで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         * @returns 呼び出し元で使用する処理結果
         */
        function handleKeyDown50(event) {
            return activateOnKeyboard(event, onSelect);
        })} onClick={(/**
         * onClickで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         */
        function handleClick51(event) { event.stopPropagation(); onSelect(); })}>
      <WorksheetContentPreview content={content} showAnswers subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls}/>
    </section>;
    }
    return <section className="content-card selected" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     */
    function handleClick52(event) { event.stopPropagation(); onSelect(); })}>
    <div className="content-controls"><button aria-label="上へ移動" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick53() {
        return commit("内容を上へ移動", moveContent(getWorksheet(), problem.id, content.id, -1));
    })}>↑</button><button aria-label="下へ移動" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick54() {
        return commit("内容を下へ移動", moveContent(getWorksheet(), problem.id, content.id, 1));
    })}>↓</button><button className="danger-text" aria-label="削除" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick55() {
        return commit("内容を削除", deleteContent(getWorksheet(), problem.id, content.id));
    })}><Trash2 size={14}/></button></div>
    {content.type === "richText" && <MixedColorDocumentEditor document={mergeColoredDocuments(content.document, content.answerDocument)} placeholder="問題文・解答を入力…" onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange56(document) {
            return update("本文を編集", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
             */
            function updateCallback57(item) { if (item.type === "richText") {
                item.document = document;
                item.answerDocument = emptyDocument();
            } }), `richText:${problem.id}:content:${content.id}`);
        })} target={{ kind: "content", contentId: content.id }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    {content.type === "box" && <div className={`box-editor box-${content.preset}`}>
      <div className="content-setting-row"><label>囲み枠</label><input value={content.title} placeholder="題名（空欄可）" onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         */
        function handleChange58(event) { const title = event.currentTarget.value; update("囲み枠の題名", (/**
         * updateへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateCallback59(item) { if (item.type === "box")
            item.title = title; }), `text:${problem.id}:content:${content.id}:title`); })}/><select value={content.preset} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange60(event) {
            return update("囲み枠デザイン", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
             */
            function updateCallback61(item) { if (item.type === "box")
                item.preset = event.target.value as typeof item.preset; }));
        })}><option value="simple">シンプル</option><option value="heading">見出し付き</option><option value="band">帯見出し</option><option value="emphasis">強調</option></select></div>
      <MixedColorDocumentEditor document={mergeColoredDocuments(content.document, content.answerDocument)} placeholder="囲み枠の問題文・解答を入力…" onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange62(document) {
            return update("囲み枠本文を編集", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
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
         * onChangeで発生した画面イベントを処理する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange64(document) {
            return update("めあてを編集", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
             */
            function updateCallback65(item) { if (item.type === "goal")
                item.document = document; }), `richText:${problem.id}:content:${content.id}`);
        })} target={{ kind: "content", contentId: content.id }} initialColor="answer" assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
    </div>}
    {content.type === "answerArea" && <AnswerAreaEditor answerArea={content.answerArea} onSettingsChange={(/**
         * onSettingsChangeで発生した画面イベントを処理する。
         *
         * @param style styleとして使用する値
         * @param rows rowsとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleSettingsChange66(style, rows) {
            return update("解答欄を設定", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
             */
            function updateCallback67(item) { if (item.type === "answerArea")
                item.answerArea = { ...item.answerArea, style, rows }; }));
        })} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param document documentとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange68(document) {
            return update("解答欄を編集", (/**
             * updateへ渡す処理を実行する。
             *
             * @param item 処理対象の値
             */
            function updateCallback69(item) { if (item.type === "answerArea") {
                item.answerArea.document = document;
                item.answerArea.answerDocument = emptyDocument();
            } }), `richText:${problem.id}:content:${content.id}:answerArea`);
        })} target={{ kind: "content", contentId: content.id }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    {content.type === "spacer" && <div className="inline-content-editor"><span>スペーサー</span><label>高さ <select value={content.rows} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange70(event) {
        return update("スペーサーを設定", (/**
         * updateへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateCallback71(item) { if (item.type === "spacer")
            item.rows = Number(event.target.value); }));
    })}>{Array.from({ length: 20 }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback72(_, index) {
        return <option value={index + 1} key={index + 1}>{index + 1}</option>;
    }))}</select> 行</label></div>}
    {content.type === "pageBreak" && <div className="page-break-editor"><span><Scissors size={15}/>ここで改ページ</span></div>}
    {content.type === "image" && <div className="image-content-editor">{assetUrls.get(content.assetId) ? <img src={assetUrls.get(content.assetId)} alt={content.alt}/> : <span className="image-content-missing">画像を読み込めません</span>}<div><strong>画像</strong><span>配置: {{ block: "独立", floatLeft: "左回り込み", floatRight: "右回り込み" }[content.placement]}</span><span>サイズ: {content.widthPercent}%</span></div><button type="button" className="small-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick73() {
        return onEditImage(null, { id: content.id, assetId: content.assetId, alt: content.alt, placement: content.placement, widthPercent: content.widthPercent, answerColor: false });
    })}><Pencil size={13}/>画像を編集</button></div>}
    {content.type === "table" && <TableEditor content={content} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param table tableとして使用する値
     * @param historyGroup historyGroupとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange74(table, historyGroup) {
        return update("表を編集", (/**
         * updateへ渡す処理を実行する。
         *
         * @param item 処理対象の値
         */
        function updateCallback75(item) { if (item.type === "table") {
            item.rows = table.rows;
            item.columnWidthsPercent = table.columnWidthsPercent;
        } }), historyGroup);
    })}/>}
    {content.type === "subQuestionGroup" && <SubQuestionEditor worksheet={worksheet} getWorksheet={getWorksheet} problem={problem} content={content} commit={commit} mutate={mutate} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
  </section>;
}
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
 * targetWithColorに必要な処理を実行する。
 *
 * @param target targetとして使用する値
 * @param color colorとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function targetWithColor(target: RichTextDocumentTarget, color: ContentColor): RichTextDocumentTarget {
    return target.kind === "solution" ? target : { ...target, color };
}
/**
 * MixedColorDocumentEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function MixedColorDocumentEditor(props: MixedColorDocumentEditorProps) {
    return <RichTextEditor compact={Boolean(props.compact)} document={props.document} assetUrls={props.assetUrls} placeholder={props.placeholder} onChange={props.onChange} initialColor={props.initialColor ?? "problem"} enableMath onImage={(/**
     * onImageで発生した画面イベントを処理する。
     *
     * @param color colorとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function handleImage76(color) {
        return props.onImage(targetWithColor(props.target, color));
    })} onEditImage={(/**
     * onEditImageで発生した画面イベントを処理する。
     *
     * @param image imageとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function handleEditImage77(image) {
        return props.onEditImage(targetWithColor(props.target, image.answerColor ? "answer" : "problem"), image);
    })} onTable={(/**
     * onTableで発生した画面イベントを処理する。
     *
     * @param color colorとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function handleTable78(color) {
        return props.onTable(targetWithColor(props.target, color));
    })}/>;
}
/**
 * AnswerAreaEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange79(event) {
        return onSettingsChange(event.target.value as "lines" | "box", answerArea.rows);
    })}><option value="lines">横罫線</option><option value="box">四角囲み</option></select></label><label>高さ <select value={answerArea.rows} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange80(event) {
        return onSettingsChange(answerArea.style, Number(event.target.value));
    })}>{Array.from({ length: 20 }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback81(_, index) {
        return <option value={index + 1} key={index + 1}>{index + 1}</option>;
    }))}</select> 行</label></div>
    <MixedColorDocumentEditor document={mergeColoredDocuments(answerArea.document, answerArea.answerDocument)} placeholder="解答欄の問題文・解答を入力…" onChange={onChange} target={target} compact assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
  </div>;
}
/**
 * SubQuestionEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * updateItemの対象となる状態を更新する。
     *
     * @param label labelとして使用する値
     * @param itemId 対象を識別するID
     * @param change changeとして使用する値
     * @param historyGroup historyGroupとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function updateItemImplementation82(label: string, itemId: string, change: (item: Draft<(typeof content.items)[number]>) => void, historyGroup?: string) {
        return mutate(label, (/**
         * mutateへ渡す処理を実行する。
         *
         * @param draft draftとして使用する値
         */
        function mutateCallback83(draft) {
            const targetProblem = draft.problems.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param entry 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem84(entry) {
                return entry.id === problem.id;
            }));
            const targetGroup = targetProblem?.contents.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param entry 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem85(entry) {
                return entry.id === content.id;
            }));
            if (targetGroup?.type !== "subQuestionGroup")
                return;
            const targetItem = targetGroup.items.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param entry 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem86(entry) {
                return entry.id === itemId;
            }));
            if (targetItem)
                change(targetItem);
        }), historyGroup ? { historyGroup } : undefined);
    });
    useOutsidePointerDown(menuRef, menuItemId !== null, (/**
     * useOutsidePointerDownへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useOutsidePointerDownCallback87() {
        return setMenuItemId(null);
    }));
    return <div className="subquestion-editor">
    <div className="subquestion-title">小問</div>
    <div className="subquestion-grid">{content.items.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem88(item) {
            return <article className={item.width === "full" ? "subquestion-card full" : "subquestion-card"} key={item.id}>
      <header>
        <span><GripVertical size={14}/>{numbers.get(item.id)}{item.numbering.restartAt !== null && <span className="status-chip">{item.numbering.restartAt}から再開</span>}</span>
        <select value={item.width} onChange={(/**
             * onChangeで発生した画面イベントを処理する。
             *
             * @param event 発生したイベント
             * @returns 呼び出し元で使用する処理結果
             */
            function handleChange89(event) {
                return updateItem("小問幅を変更", item.id, (/**
                 * updateItemへ渡す処理を実行する。
                 *
                 * @param entry 処理対象の値
                 */
                function updateItemCallback90(entry) { entry.width = event.target.value as typeof entry.width; }));
            })}><option value="column">半幅</option><option value="full">全幅</option></select>
        <div className="relative" ref={menuItemId === item.id ? menuRef : undefined}>
          <button className="icon-button" aria-label="小問設定" onClick={(/**
             * onClickで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleClick91() {
                return setMenuItemId(menuItemId === item.id ? null : item.id);
            })}><MoreHorizontal size={14}/></button>
          {menuItemId === item.id && <SubQuestionMenu getWorksheet={getWorksheet} problem={problem} groupId={content.id} item={item} commit={commit}/>}
        </div>
        <button className="icon-button" disabled={content.items.length <= 1} aria-label="小問を削除" onClick={(/**
             * onClickで発生した画面イベントを処理する。
             *
             * @returns 呼び出し元で使用する処理結果
             */
            function handleClick92() {
                return commit("小問を削除", deleteSubQuestion(getWorksheet(), problem.id, content.id, item.id));
            })}><Trash2 size={14}/></button>
      </header>
      <MixedColorDocumentEditor compact document={mergeColoredDocuments(item.content, item.answerContent)} placeholder="小問の問題文・解答を入力…" onChange={(/**
             * onChangeで発生した画面イベントを処理する。
             *
             * @param document documentとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function handleChange93(document) {
                return updateItem("小問を編集", item.id, (/**
                 * updateItemへ渡す処理を実行する。
                 *
                 * @param entry 処理対象の値
                 */
                function updateItemCallback94(entry) { entry.content = document; entry.answerContent = emptyDocument(); }), `richText:${problem.id}:subQuestion:${content.id}:${item.id}:content`);
            })} target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "content" }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>
      {item.answerArea && <AnswerAreaEditor answerArea={item.answerArea} onSettingsChange={(/**
                 * onSettingsChangeで発生した画面イベントを処理する。
                 *
                 * @param style styleとして使用する値
                 * @param rows rowsとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleSettingsChange95(style, rows) {
                    return updateItem("小問解答欄を設定", item.id, (/**
                     * updateItemへ渡す処理を実行する。
                     *
                     * @param entry 処理対象の値
                     */
                    function updateItemCallback96(entry) { if (entry.answerArea)
                        entry.answerArea = { ...entry.answerArea, style, rows }; }));
                })} onChange={(/**
                 * onChangeで発生した画面イベントを処理する。
                 *
                 * @param document documentとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleChange97(document) {
                    return updateItem("小問解答欄を編集", item.id, (/**
                     * updateItemへ渡す処理を実行する。
                     *
                     * @param entry 処理対象の値
                     */
                    function updateItemCallback98(entry) { if (entry.answerArea) {
                        entry.answerArea.document = document;
                        entry.answerArea.answerDocument = emptyDocument();
                    } }), `richText:${problem.id}:subQuestion:${content.id}:${item.id}:answerArea`);
                })} target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "answerArea" }} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable}/>}
    </article>;
        }))}</div>
    <button className="small-button" disabled={content.items.length >= 100} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick99() {
        return commit("小問を追加", addSubQuestion(getWorksheet(), problem.id, content.id));
    })}><Plus size={14}/>小問を追加</button>
  </div>;
}
/**
 * SubQuestionMenuコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
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
     * onClickで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick100(event) {
        return event.stopPropagation();
    })}>
    <label className="menu-check"><input type="checkbox" checked={item.numbering.restartAt !== null} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange101(event) {
        return commit("小問の振り直しを切替", updateSubQuestion(getWorksheet(), problem.id, groupId, item.id, (/**
         * updateSubQuestionへ渡す処理を実行する。
         *
         * @param entry 処理対象の値
         */
        function updateSubQuestionCallback102(entry) { entry.numbering.restartAt = event.target.checked ? 1 : null; })));
    })}/>この小問から番号を振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={item.numbering.restartAt === null} value={item.numbering.restartAt ?? 1} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange103(event) {
        return commit("小問の開始番号を変更", updateSubQuestion(getWorksheet(), problem.id, groupId, item.id, (/**
         * updateSubQuestionへ渡す処理を実行する。
         *
         * @param entry 処理対象の値
         */
        function updateSubQuestionCallback104(entry) { entry.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); })));
    })}/></label>
  </div>;
}
/**
 * TableEditorコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function TableEditor(props: {
    content: Extract<ContentBlock, {
        type: "table";
    }>;
    onChange: (table: EditableTableData, historyGroup?: string) => void;
}) {
    let { content, onChange } = props;
    const [activeCellId, setActiveCellId] = useState<string | null>((/**
     * useStateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
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
     * updateCellの対象となる状態を更新する。
     *
     * @param cellId 対象を識別するID
     * @param document documentとして使用する値
     */
    function updateCellImplementation106(cellId: string, document: typeof content.rows[number]["cells"][number]["document"]) {
        const rows = structuredClone(content.rows);
        for (const row of rows) {
            const cell = row.cells.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
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
     * operateに必要な処理を実行する。
     *
     * @param operation operationとして使用する値
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
     * setRowHeightの対象となる状態を更新する。
     *
     * @param heightMm heightMmとして使用する値
     */
    function setRowHeightImplementation109(heightMm: number | null) {
        if (!activeLocation)
            return;
        const result = setTableRowHeight(tableData, activeLocation.row, heightMm);
        if (result)
            onChange(result);
    });
    const setColumnWidth = (/**
     * setColumnWidthの対象となる状態を更新する。
     *
     * @param widthPercent widthPercentとして使用する値
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
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param width widthとして使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem111(width, index) {
        return <col key={index} style={{ width: `${width}%` }}/>;
    }))}</colgroup><tbody>{content.rows.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param row rowとして使用する値
         * @param rowIndex rowIndexとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem112(row, rowIndex) {
            return <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param cell cellとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem113(cell) {
                    const Cell = content.headerRow && rowIndex === 0 ? "th" : "td";
                    const location = getTableCellLocation(tableData, cell.id);
                    const logicalColumn = location?.column ?? 0;
                    return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan} className={resolvedActiveCellId === cell.id ? "active" : ""}>
        {resolvedActiveCellId === cell.id
                            ? <RichTextEditor tableCell compact toolbarContainer={toolbarContainer} document={cell.document} placeholder={`${rowIndex + 1}行${logicalColumn + 1}列`} onChange={(/**
                             * onChangeで発生した画面イベントを処理する。
                             *
                             * @param document documentとして使用する値
                             * @returns 呼び出し元で使用する処理結果
                             */
                            function handleChange114(document) {
                                return updateCell(cell.id, document as typeof cell.document);
                            })}/>
                            : <button type="button" className="table-cell-select" aria-label={`${rowIndex + 1}行${logicalColumn + 1}列を編集`} onClick={(/**
                             * onClickで発生した画面イベントを処理する。
                             *
                             * @returns 呼び出し元で使用する処理結果
                             */
                            function handleClick115() {
                                return setActiveCellId(cell.id);
                            })}><TableCellDocumentPreview document={cell.document}/></button>}
      </Cell>;
                }))}</tr>;
        }))}</tbody></table>
  </div>;
}
/**
 * TableCellDocumentPreviewコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function TableCellDocumentPreview(props: {
    document: Extract<ContentBlock, {
        type: "table";
    }>["rows"][number]["cells"][number]["document"];
}) {
    let { document } = props;
    const visible = document.content.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param node 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function hasMatchingItem116(node) {
        return node.type === "imageRef" || node.content.length > 0;
    }));
    if (!visible)
        return <span className="table-cell-empty">空のセル</span>;
    return <>{document.content.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param node 処理対象の値
         * @param blockIndex blockIndexとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem117(node, blockIndex) {
            return node.type === "imageRef"
                ? <span className={node.attrs.answerColor ? "answer-color" : undefined} key={blockIndex}>[画像]</span>
                : <span className="table-cell-preview-paragraph" key={blockIndex}>{node.content.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param child childとして使用する値
                 * @param childIndex childIndexとして使用する値
                 * @returns 呼び出し元で使用する処理結果
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
 * renderTableCellInlineに対応する画面表示を更新する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
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
