import { ChevronDown, ChevronRight, Copy, GripVertical, MoreHorizontal, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { colorDocumentAsAnswer, mergeColoredDocuments, type ContentColor } from "../../domain/worksheet/rich-text";
import type { AnswerArea, AssetRecord, BasicRichTextDocument, ContentBlock, ImagePlacement, ImageWidthPercent, ProblemBlock, TableCellRichTextDocument, Worksheet } from "../../domain/worksheet/worksheet";
import { applyTableOperation, getTableCellLocation, getTableOperationAvailability, setTableColumnWidth, setTableRowHeight, type EditableTableData, type TableOperation } from "../../domain/worksheet/table-operations";
import {
  addContent,
  addSubQuestion,
  deleteContent,
  deleteProblem,
  deleteSubQuestion,
  duplicateProblem,
  moveContent,
  moveProblem,
  setProblemSolution,
  updateContent,
  updateProblem,
  updateRichTextDocument,
  updateSubQuestion,
  type RichTextDocumentTarget,
  type WorksheetCommandResult,
} from "../../domain/worksheet/worksheet.commands";
import { createContentBlock, emptyDocument, emptySolutionDocument } from "../../domain/worksheet/worksheet.defaults";
import { getSubQuestionNumbers } from "../../domain/worksheet/worksheet.numbering";
import { MathFormula } from "../components/MathFormula";
import { RichTextEditor } from "../components/RichTextEditor";
import { TableStructureToolbar } from "../components/TableStructureToolbar";
import { useOutsidePointerDown } from "../components/useOutsidePointerDown";
import type { EditableImageRef } from "../components/rich-text-editor-extensions";
import { ImageDialog, TableDialog } from "../dialogs/EditorDialogs";

type Props = {
  worksheet: Worksheet;
  problem: ProblemBlock;
  index: number;
  displayNumber: string | null;
  selected: boolean;
  selectedContentId: string | null;
  onSelect: () => void;
  onSelectContent: (id: string | null) => void;
  onCommit: (label: string, worksheet: Worksheet) => void;
  onAddImage: (problemId: string, asset: AssetRecord, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => void;
  onUpdateImage: (problemId: string, imageId: string, asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string, target?: RichTextDocumentTarget) => void;
  assetUrls: ReadonlyMap<string, string>;
  onToast: (message: string) => void;
};

type AddContentType = Exclude<ContentBlock["type"], "image" | "table">;

const ADD_CONTENT_OPTIONS: ReadonlyArray<readonly [AddContentType, string]> = [
  ["richText", "本文"],
  ["box", "囲み枠"],
  ["goal", "めあて"],
  ["subQuestionGroup", "小問"],
  ["answerArea", "解答欄"],
  ["spacer", "スペーサー"],
  ["pageBreak", "改ページ"],
];

export function ProblemCard(props: Props) {
  const { worksheet, problem, index, displayNumber, selected, selectedContentId, onSelect, onSelectContent, onCommit, onAddImage, onUpdateImage, assetUrls, onToast } = props;
  const [problemMenu, setProblemMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [tableTarget, setTableTarget] = useState<RichTextDocumentTarget | null | undefined>(undefined);
  const [imageDialog, setImageDialog] = useState<ImageDialogState | null>(null);
  const problemMenuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useOutsidePointerDown(problemMenuRef, problemMenu, () => setProblemMenu(false));
  useOutsidePointerDown(addMenuRef, addMenu, () => setAddMenu(false));

  const commit = (label: string, result: WorksheetCommandResult) => {
    if (result.ok) onCommit(label, result.worksheet);
    else if (result.code === "LAST_ITEM") onToast("プリントには1問以上必要です");
    else if (result.code === "STRUCTURE_LIMIT_EXCEEDED") onToast("追加できる件数の上限に達しています");
  };

  const addBlock = (type: AddContentType) => {
    const content = createContentBlock(type);
    commit("内容を追加", addContent(worksheet, problem.id, content, selectedContentId));
    onSelectContent(content.id); setAddMenu(false);
  };

  return <article className={selected ? "problem-card selected" : "problem-card"} onClick={onSelect}>
    <header className="problem-card-header">
      <div className="problem-title"><button className="drag-handle" aria-label="問題を並べ替え"><GripVertical size={18} /></button><select className="problem-kind-select" aria-label="問題の種類" value={problem.kind} onClick={(event) => event.stopPropagation()} onChange={(event) => commit("問題の種類を変更", updateProblem(worksheet, problem.id, (item) => { item.kind = event.target.value as typeof item.kind; }))}><option value="problem">問題</option><option value="example">例題</option></select><span>{displayNumber ? displayNumber.replace(/[^0-9]/gu, "") || displayNumber : "番号なし"}</span>{problem.numbering.restartAt && <span className="status-chip">{problem.numbering.restartAt}から再開</span>}</div>
      <div className="problem-actions"><button className="small-button" disabled={worksheet.problems.length >= 200} onClick={(event) => { event.stopPropagation(); commit("問題を複製", duplicateProblem(worksheet, problem.id)); }}><Copy size={14} />複製</button><div className="relative" ref={problemMenuRef}><button className="icon-button" aria-label="問題設定" onClick={(event) => { event.stopPropagation(); setProblemMenu(!problemMenu); }}><MoreHorizontal size={18} /></button>{problemMenu && <ProblemMenu worksheet={worksheet} problem={problem} index={index} commit={commit} close={() => setProblemMenu(false)} />}</div></div>
    </header>
    <div className="content-list">
      {problem.contents.length === 0 && <div className="empty-problem"><p>{problem.kind === "example" ? "例題" : "問題"}{displayNumber ?? ""}には内容がありません。</p><span>「内容を追加」から編集を再開できます。</span></div>}
      {problem.contents.map((content) => <ContentEditor key={content.id} worksheet={worksheet} problem={problem} content={content} selected={selectedContentId === content.id} onSelect={() => onSelectContent(content.id)} commit={commit} assetUrls={assetUrls} onImage={(target) => setImageDialog({ mode: "insert", target })} onEditImage={(target, image) => setImageDialog({ mode: "edit", target, image })} onTable={setTableTarget} />)}
    </div>
    <div className="solution-section">
      <button className="solution-toggle" onClick={(event) => { event.stopPropagation(); setSolutionOpen(!solutionOpen); }}>{solutionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}教師用の解説{problem.solution && <span className="status-chip">入力済み</span>}</button>
      {solutionOpen && <div className="solution-editor"><label>解説</label><RichTextEditor
        document={(problem.solution ?? emptySolutionDocument()) as never}
        assetUrls={assetUrls}
        onChange={(document) => commit("教師用の解説を編集", setProblemSolution(worksheet, problem.id, document as never))}
        enableMath
        showColorSelector={false}
        onImage={() => setImageDialog({ mode: "insert", target: { kind: "solution" } })}
        onEditImage={(image) => setImageDialog({ mode: "edit", target: { kind: "solution" }, image })}
        onTable={() => setTableTarget({ kind: "solution" })}
      /></div>}
    </div>
    <div className="add-content-wrap" ref={addMenuRef}><button className="add-content-button" onClick={(event) => { event.stopPropagation(); setAddMenu(!addMenu); }}><Plus size={16} />内容を追加</button>{addMenu && <div className="add-content-popover"><strong>追加する内容</strong><div>{ADD_CONTENT_OPTIONS.map(([type, label]) => <button key={type} onClick={(event) => { event.stopPropagation(); addBlock(type); }}>{label}</button>)}</div></div>}</div>
    {tableTarget !== undefined && <TableDialog onClose={() => setTableTarget(undefined)} onInsert={(table) => {
      if (tableTarget === null) {
        commit("表を挿入", addContent(worksheet, problem.id, table, selectedContentId));
        onSelectContent(table.id);
      } else {
        commit("表を挿入", updateRichTextDocument(worksheet, problem.id, tableTarget, (document) => {
          document.content.push({ type: "richTable", attrs: { id: table.id, rows: table.rows, columnWidthsPercent: table.columnWidthsPercent, headerRow: table.headerRow, answerColor: tableTarget.kind !== "solution" && tableTarget.color === "answer" } });
        }));
        onSelectContent(tableTarget.kind === "content" ? tableTarget.contentId : tableTarget.kind === "subQuestion" ? tableTarget.groupId : null);
      }
      setTableTarget(undefined);
    }} />}
    {imageDialog && <ImageDialog worksheetId={worksheet.id} {...(imageDialog.mode === "edit" ? { initial: { placement: imageDialog.image.placement, widthPercent: imageDialog.image.widthPercent, alt: imageDialog.image.alt, ...(assetUrls.get(imageDialog.image.assetId) ? { previewUrl: assetUrls.get(imageDialog.image.assetId)! } : {}) } } : {})} onClose={() => setImageDialog(null)} onApply={(asset, placement, width, alt) => {
      if (imageDialog.mode === "insert") {
        if (asset) onAddImage(problem.id, asset, placement, width, alt, imageDialog.target ?? undefined);
      } else {
        onUpdateImage(problem.id, imageDialog.image.id, asset, placement, width, alt, imageDialog.target ?? undefined);
      }
      setImageDialog(null);
    }} />}
  </article>;
}

type ImageDialogState =
  | { mode: "insert"; target: RichTextDocumentTarget | null }
  | { mode: "edit"; target: RichTextDocumentTarget | null; image: EditableImageRef };

function ProblemMenu({ worksheet, problem, index, commit, close }: { worksheet: Worksheet; problem: ProblemBlock; index: number; commit: (label: string, result: WorksheetCommandResult) => void; close: () => void }) {
  return <div className="problem-menu" onClick={(event) => event.stopPropagation()}>
    <button onClick={() => { commit("問題を複製", duplicateProblem(worksheet, problem.id)); close(); }}>問題を複製</button>
    <button disabled={index === 0} onClick={() => { commit("問題を上へ移動", moveProblem(worksheet, problem.id, index - 1)); close(); }}>上へ移動 <kbd>Alt + ↑</kbd></button>
    <button disabled={index === worksheet.problems.length - 1} onClick={() => { commit("問題を下へ移動", moveProblem(worksheet, problem.id, index + 1)); close(); }}>下へ移動 <kbd>Alt + ↓</kbd></button><hr />
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.enabled} onChange={(event) => commit("採番を切替", updateProblem(worksheet, problem.id, (item) => { item.numbering.enabled = event.target.checked; }))} />番号を付ける</label>
    <label className="menu-check"><input type="checkbox" checked={problem.numbering.restartAt !== null} onChange={(event) => commit("振り直しを切替", updateProblem(worksheet, problem.id, (item) => { item.numbering.restartAt = event.target.checked ? 1 : null; }))} />この項目から振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={problem.numbering.restartAt === null} value={problem.numbering.restartAt ?? 1} onChange={(event) => commit("開始番号を変更", updateProblem(worksheet, problem.id, (item) => { item.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); }))} /></label><hr />
    <button className="danger-text" disabled={worksheet.problems.length === 1} title={worksheet.problems.length === 1 ? "プリントには1問以上必要です" : undefined} onClick={() => { commit("問題を削除", deleteProblem(worksheet, problem.id)); close(); }}><Trash2 size={14} />問題を削除</button>
  </div>;
}

function ContentEditor({ worksheet, problem, content, selected, onSelect, commit, onImage, onEditImage, onTable, assetUrls }: { worksheet: Worksheet; problem: ProblemBlock; content: ContentBlock; selected: boolean; onSelect: () => void; commit: (label: string, result: WorksheetCommandResult) => void; onImage: (target: RichTextDocumentTarget) => void; onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void; onTable: (target: RichTextDocumentTarget) => void; assetUrls: ReadonlyMap<string, string> }) {
  const update = (label: string, change: (content: ContentBlock) => void) => commit(label, updateContent(worksheet, problem.id, content.id, change));
  return <section className={selected ? "content-card selected" : "content-card"} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
    {selected && <div className="content-controls"><button aria-label="上へ移動" onClick={() => commit("内容を上へ移動", moveContent(worksheet, problem.id, content.id, -1))}>↑</button><button aria-label="下へ移動" onClick={() => commit("内容を下へ移動", moveContent(worksheet, problem.id, content.id, 1))}>↓</button><button className="danger-text" aria-label="削除" onClick={() => commit("内容を削除", deleteContent(worksheet, problem.id, content.id))}><Trash2 size={14} /></button></div>}
    {content.type === "richText" && <MixedColorDocumentEditor
      document={mergeColoredDocuments(content.document, content.answerDocument)}
      placeholder="問題文・解答を入力…"
      onChange={(document) => update("本文を編集", (item) => { if (item.type === "richText") { item.document = document; item.answerDocument = emptyDocument(); } })}
      target={{ kind: "content", contentId: content.id }}
      assetUrls={assetUrls}
      onImage={onImage}
      onEditImage={onEditImage}
      onTable={onTable}
    />}
    {content.type === "box" && <div className={`box-editor box-${content.preset}`}>
      <div className="content-setting-row"><label>囲み枠</label><input value={content.title} placeholder="題名（空欄可）" onChange={(event) => update("囲み枠の題名", (item) => { if (item.type === "box") item.title = event.target.value; })} /><select value={content.preset} onChange={(event) => update("囲み枠デザイン", (item) => { if (item.type === "box") item.preset = event.target.value as typeof item.preset; })}><option value="simple">シンプル</option><option value="heading">見出し付き</option><option value="band">帯見出し</option><option value="emphasis">強調</option></select></div>
      <MixedColorDocumentEditor
        document={mergeColoredDocuments(content.document, content.answerDocument)}
        placeholder="囲み枠の問題文・解答を入力…"
        onChange={(document) => update("囲み枠本文を編集", (item) => { if (item.type === "box") { item.document = document; item.answerDocument = emptyDocument(); } })}
        target={{ kind: "content", contentId: content.id }}
        assetUrls={assetUrls}
        onImage={onImage}
        onEditImage={onEditImage}
        onTable={onTable}
      />
    </div>}
    {content.type === "goal" && <div className="goal-editor">
      <div className="content-setting-row"><strong>めあて</strong><small>初期入力色は解答色（赤）です</small></div>
      <MixedColorDocumentEditor
        document={colorDocumentAsAnswer(content.document)}
        placeholder="めあてを入力…"
        onChange={(document) => update("めあてを編集", (item) => { if (item.type === "goal") item.document = document; })}
        target={{ kind: "content", contentId: content.id }}
        initialColor="answer"
        assetUrls={assetUrls}
        onImage={onImage}
        onEditImage={onEditImage}
        onTable={onTable}
      />
    </div>}
    {content.type === "answerArea" && <AnswerAreaEditor
      answerArea={content.answerArea}
      onSettingsChange={(style, rows) => update("解答欄を設定", (item) => { if (item.type === "answerArea") item.answerArea = { ...item.answerArea, style, rows }; })}
      onChange={(document) => update("解答欄を編集", (item) => { if (item.type === "answerArea") { item.answerArea.document = document; item.answerArea.answerDocument = emptyDocument(); } })}
      target={{ kind: "content", contentId: content.id }}
      assetUrls={assetUrls}
      onImage={onImage}
      onEditImage={onEditImage}
      onTable={onTable}
    />}
    {content.type === "spacer" && <div className="inline-content-editor"><span>スペーサー</span><label>高さ <select value={content.rows} onChange={(event) => update("スペーサーを設定", (item) => { if (item.type === "spacer") item.rows = Number(event.target.value); })}>{Array.from({ length: 20 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select> 行</label></div>}
    {content.type === "pageBreak" && <div className="page-break-editor"><span><Scissors size={15} />ここで改ページ</span></div>}
    {content.type === "image" && <div className="image-content-editor">{assetUrls.get(content.assetId) ? <img src={assetUrls.get(content.assetId)} alt={content.alt} /> : <span className="image-content-missing">画像を読み込めません</span>}<div><strong>画像</strong><span>配置: {{ block: "独立", floatLeft: "左回り込み", floatRight: "右回り込み" }[content.placement]}</span><span>サイズ: {content.widthPercent}%</span></div><button type="button" className="small-button" onClick={() => onEditImage(null, { id: content.id, assetId: content.assetId, alt: content.alt, placement: content.placement, widthPercent: content.widthPercent, answerColor: false })}><Pencil size={13} />画像を編集</button></div>}
    {content.type === "table" && <TableEditor content={content} onChange={(table) => update("表を編集", (item) => { if (item.type === "table") { item.rows = table.rows; item.columnWidthsPercent = table.columnWidthsPercent; } })} />}
    {content.type === "subQuestionGroup" && <SubQuestionEditor worksheet={worksheet} problem={problem} content={content} commit={commit} assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable} />}
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

function targetWithColor(target: RichTextDocumentTarget, color: ContentColor): RichTextDocumentTarget {
  return target.kind === "solution" ? target : { ...target, color };
}

function MixedColorDocumentEditor(props: MixedColorDocumentEditorProps) {
  return <RichTextEditor
    compact={Boolean(props.compact)}
    document={props.document}
    assetUrls={props.assetUrls}
    placeholder={props.placeholder}
    onChange={props.onChange}
    initialColor={props.initialColor ?? "problem"}
    enableMath
    onImage={(color) => props.onImage(targetWithColor(props.target, color))}
    onEditImage={(image) => props.onEditImage(targetWithColor(props.target, image.answerColor ? "answer" : "problem"), image)}
    onTable={(color) => props.onTable(targetWithColor(props.target, color))}
  />;
}

function AnswerAreaEditor({ answerArea, onSettingsChange, onChange, target, assetUrls, onImage, onEditImage, onTable }: { answerArea: AnswerArea; onSettingsChange: (style: "lines" | "box", rows: number) => void; onChange: (document: BasicRichTextDocument) => void; target: RichTextDocumentTarget; assetUrls: ReadonlyMap<string, string>; onImage: (target: RichTextDocumentTarget) => void; onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void; onTable: (target: RichTextDocumentTarget) => void }) {
  return <div className="answer-area-editor">
    <div className="inline-content-editor answer-area-settings"><strong>生徒用解答欄</strong><label>種類 <select value={answerArea.style} onChange={(event) => onSettingsChange(event.target.value as "lines" | "box", answerArea.rows)}><option value="lines">横罫線</option><option value="box">四角囲み</option></select></label><label>高さ <select value={answerArea.rows} onChange={(event) => onSettingsChange(answerArea.style, Number(event.target.value))}>{Array.from({ length: 20 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}</option>)}</select> 行</label></div>
    <MixedColorDocumentEditor document={mergeColoredDocuments(answerArea.document, answerArea.answerDocument)} placeholder="解答欄の問題文・解答を入力…" onChange={onChange} target={target} compact assetUrls={assetUrls} onImage={onImage} onEditImage={onEditImage} onTable={onTable} />
  </div>;
}

function SubQuestionEditor({ worksheet, problem, content, commit, assetUrls, onImage, onEditImage, onTable }: { worksheet: Worksheet; problem: ProblemBlock; content: Extract<ContentBlock, { type: "subQuestionGroup" }>; commit: (label: string, result: WorksheetCommandResult) => void; assetUrls: ReadonlyMap<string, string>; onImage: (target: RichTextDocumentTarget) => void; onEditImage: (target: RichTextDocumentTarget | null, image: EditableImageRef) => void; onTable: (target: RichTextDocumentTarget) => void }) {
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const numbers = getSubQuestionNumbers(content, worksheet.pageSettings.subQuestionNumberFormat);

  useOutsidePointerDown(menuRef, menuItemId !== null, () => setMenuItemId(null));

  return <div className="subquestion-editor">
    <div className="subquestion-title">小問</div>
    <div className="subquestion-grid">{content.items.map((item) => <article className={item.width === "full" ? "subquestion-card full" : "subquestion-card"} key={item.id}>
      <header>
        <span><GripVertical size={14} />{numbers.get(item.id)}{item.numbering.restartAt !== null && <span className="status-chip">{item.numbering.restartAt}から再開</span>}</span>
        <select value={item.width} onChange={(event) => commit("小問幅を変更", updateSubQuestion(worksheet, problem.id, content.id, item.id, (entry) => { entry.width = event.target.value as typeof entry.width; }))}><option value="column">半幅</option><option value="full">全幅</option></select>
        <div className="relative" ref={menuItemId === item.id ? menuRef : undefined}>
          <button className="icon-button" aria-label="小問設定" onClick={() => setMenuItemId(menuItemId === item.id ? null : item.id)}><MoreHorizontal size={14} /></button>
          {menuItemId === item.id && <SubQuestionMenu worksheet={worksheet} problem={problem} groupId={content.id} item={item} commit={commit} />}
        </div>
        <button className="icon-button" disabled={content.items.length <= 1} aria-label="小問を削除" onClick={() => commit("小問を削除", deleteSubQuestion(worksheet, problem.id, content.id, item.id))}><Trash2 size={14} /></button>
      </header>
      <MixedColorDocumentEditor
        compact
        document={mergeColoredDocuments(item.content, item.answerContent)}
        placeholder="小問の問題文・解答を入力…"
        onChange={(document) => commit("小問を編集", updateSubQuestion(worksheet, problem.id, content.id, item.id, (entry) => { entry.content = document; entry.answerContent = emptyDocument(); }))}
        target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "content" }}
        assetUrls={assetUrls}
        onImage={onImage}
        onEditImage={onEditImage}
        onTable={onTable}
      />
      {item.answerArea && <AnswerAreaEditor
        answerArea={item.answerArea}
        onSettingsChange={(style, rows) => commit("小問解答欄を設定", updateSubQuestion(worksheet, problem.id, content.id, item.id, (entry) => { if (entry.answerArea) entry.answerArea = { ...entry.answerArea, style, rows }; }))}
        onChange={(document) => commit("小問解答欄を編集", updateSubQuestion(worksheet, problem.id, content.id, item.id, (entry) => { if (entry.answerArea) { entry.answerArea.document = document; entry.answerArea.answerDocument = emptyDocument(); } }))}
        target={{ kind: "subQuestion", groupId: content.id, subQuestionId: item.id, field: "answerArea" }}
        assetUrls={assetUrls}
        onImage={onImage}
        onEditImage={onEditImage}
        onTable={onTable}
      />}
    </article>)}</div>
    <button className="small-button" disabled={content.items.length >= 100} onClick={() => commit("小問を追加", addSubQuestion(worksheet, problem.id, content.id))}><Plus size={14} />小問を追加</button>
  </div>;
}

function SubQuestionMenu({ worksheet, problem, groupId, item, commit }: { worksheet: Worksheet; problem: ProblemBlock; groupId: string; item: Extract<ContentBlock, { type: "subQuestionGroup" }>["items"][number]; commit: (label: string, result: WorksheetCommandResult) => void }) {
  return <div className="problem-menu subquestion-menu" onClick={(event) => event.stopPropagation()}>
    <label className="menu-check"><input type="checkbox" checked={item.numbering.restartAt !== null} onChange={(event) => commit("小問の振り直しを切替", updateSubQuestion(worksheet, problem.id, groupId, item.id, (entry) => { entry.numbering.restartAt = event.target.checked ? 1 : null; }))} />この小問から番号を振り直す</label>
    <label className="menu-number">開始番号<input type="number" min={1} disabled={item.numbering.restartAt === null} value={item.numbering.restartAt ?? 1} onChange={(event) => commit("小問の開始番号を変更", updateSubQuestion(worksheet, problem.id, groupId, item.id, (entry) => { entry.numbering.restartAt = Math.max(1, event.target.valueAsNumber || 1); }))} /></label>
  </div>;
}

function TableEditor({ content, onChange }: { content: Extract<ContentBlock, { type: "table" }>; onChange: (table: EditableTableData) => void }) {
  const [activeCellId, setActiveCellId] = useState<string | null>(() => content.rows[0]?.cells[0]?.id ?? null);
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);
  const tableData: EditableTableData = { rows: content.rows, columnWidthsPercent: content.columnWidthsPercent };
  const availability = activeCellId ? getTableOperationAvailability(tableData, activeCellId) : null;
  const activeLocation = activeCellId ? getTableCellLocation(tableData, activeCellId) : null;

  useEffect(() => {
    if (activeCellId && getTableCellLocation(tableData, activeCellId)) return;
    setActiveCellId(content.rows[0]?.cells[0]?.id ?? null);
  }, [activeCellId, content.rows, content.columnWidthsPercent]);

  const updateCell = (cellId: string, document: typeof content.rows[number]["cells"][number]["document"]) => {
    const rows = structuredClone(content.rows);
    for (const row of rows) {
      const cell = row.cells.find((item) => item.id === cellId);
      if (cell) {
        cell.document = document;
        onChange({ rows, columnWidthsPercent: content.columnWidthsPercent });
        return;
      }
    }
  };
  const operate = (operation: TableOperation) => {
    if (!activeCellId) return;
    const result = applyTableOperation(tableData, activeCellId, operation);
    if (!result) return;
    setActiveCellId(result.activeCellId);
    onChange({ rows: result.rows, columnWidthsPercent: result.columnWidthsPercent });
  };
  const setRowHeight = (heightMm: number | null) => {
    if (!activeLocation) return;
    const result = setTableRowHeight(tableData, activeLocation.row, heightMm);
    if (result) onChange(result);
  };
  const setColumnWidth = (widthPercent: number) => {
    if (!activeLocation) return;
    const result = setTableColumnWidth(tableData, activeLocation.column, widthPercent);
    if (result) onChange(result);
  };

  return <div className="table-content-editor">
    <div className="content-setting-row"><strong>表</strong><span>{content.rows.length}行 × {content.columnWidthsPercent.length}列</span><small>セルにカーソルを置き、上の∑から数式を挿入できます</small></div>
    {availability && activeLocation && <TableStructureToolbar
      availability={availability}
      onOperation={operate}
      sizing={{
        rowHeightMm: content.rows[activeLocation.row]?.heightMm ?? null,
        columnWidthPercent: content.columnWidthsPercent[activeLocation.column] ?? 100,
        canResizeColumn: content.columnWidthsPercent.length > 1,
        onRowHeightChange: setRowHeight,
        onColumnWidthChange: setColumnWidth,
      }}
    />}
    <div className="table-cell-toolbar-host" ref={setToolbarContainer} />
    <table><colgroup>{content.columnWidthsPercent.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><tbody>{content.rows.map((row, rowIndex) => <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((cell) => {
      const Cell = content.headerRow && rowIndex === 0 ? "th" : "td";
      const location = getTableCellLocation(tableData, cell.id);
      const logicalColumn = location?.column ?? 0;
      return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan} className={activeCellId === cell.id ? "active" : ""}>
        {activeCellId === cell.id
          ? <RichTextEditor tableCell compact toolbarContainer={toolbarContainer} document={cell.document} placeholder={`${rowIndex + 1}行${logicalColumn + 1}列`} onChange={(document) => updateCell(cell.id, document as typeof cell.document)} />
          : <button type="button" className="table-cell-select" aria-label={`${rowIndex + 1}行${logicalColumn + 1}列を編集`} onClick={() => setActiveCellId(cell.id)}><TableCellDocumentPreview document={cell.document} /></button>}
      </Cell>;
    })}</tr>)}</tbody></table>
  </div>;
}

function TableCellDocumentPreview({ document }: { document: Extract<ContentBlock, { type: "table" }>["rows"][number]["cells"][number]["document"] }) {
  const visible = document.content.some((node) => node.type === "imageRef" || node.content.length > 0);
  if (!visible) return <span className="table-cell-empty">空のセル</span>;
  return <>{document.content.map((node, blockIndex) => node.type === "imageRef"
    ? <span className={node.attrs.answerColor ? "answer-color" : undefined} key={blockIndex}>[画像]</span>
    : <span className="table-cell-preview-paragraph" key={blockIndex}>{node.content.map((child, childIndex) => <span key={childIndex}>{renderTableCellInline(child)}</span>)}</span>)}</>;
}

type TableCellInlineNode = Extract<TableCellRichTextDocument["content"][number], { type: "paragraph" }>["content"][number];

function renderTableCellInline(node: TableCellInlineNode): ReactNode {
  if (node.type === "hardBreak") return <br />;
  if (node.type === "inlineMath") return <span className={node.attrs.answerColor ? "answer-color" : undefined}><MathFormula latex={node.attrs.latex} textSize={node.attrs.textSize} /></span>;
  let rendered: ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") rendered = <strong>{rendered}</strong>;
    else if (mark.type === "underline") rendered = <u>{rendered}</u>;
    else if (mark.type === "italic") rendered = <em>{rendered}</em>;
    else if (mark.type === "textSize") rendered = <span className={`text-size-${mark.attrs.size}`}>{rendered}</span>;
    else if (mark.type === "answerColor") rendered = <span className="answer-color">{rendered}</span>;
  }
  return rendered;
}
