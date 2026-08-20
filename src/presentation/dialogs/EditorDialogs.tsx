import { Sigma, Table2, Upload } from "lucide-react";
import { createElement, useEffect, useMemo, useRef, useState } from "react";

import type { PreviewMode } from "../../application/pdf/generate-pdf";
import type { AssetRecord, ImagePlacement, ImageWidthPercent, PageSettings, Worksheet, WorksheetHeader } from "../../domain/worksheet/worksheet";
import { createId, createTableBlock } from "../../domain/worksheet/worksheet.defaults";
import { downloadBlob, localTimestamp, sanitizeFileNamePart } from "../../infrastructure/file/download";
import { MathFormula } from "../components/MathFormula";
import { ManualContextLink } from "../components/ManualContextLink";
import type { MathTextSize } from "../components/rich-text-editor-extensions";
import { Modal } from "../components/Modal";
import { WorksheetPreview } from "../preview/WorksheetPreview";

export function WorksheetSettingsDialog({ worksheet, onClose, onApply }: { worksheet: Worksheet; onClose: () => void; onApply: (pageSettings: PageSettings, header: Omit<WorksheetHeader, "title">) => void }) {
  const [pageSettings, setPageSettings] = useState(() => structuredClone(worksheet.pageSettings));
  const [header, setHeader] = useState(() => structuredClone(worksheet.header));
  return <Modal title="プリント設定" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" onClick={() => onApply(pageSettings, { gradeField: header.gradeField, classField: header.classField, numberField: header.numberField, nameField: header.nameField, firstPageOnly: true })}>適用</button></>}>
    <div className="form-section"><h3>用紙</h3><div className="form-row"><span className="form-label">サイズ</span><label><input type="radio" checked={pageSettings.size === "B5"} onChange={() => setPageSettings({ ...pageSettings, size: "B5" })} /> JIS B5（182×257mm）</label><label><input type="radio" checked={pageSettings.size === "A4"} onChange={() => setPageSettings({ ...pageSettings, size: "A4" })} /> A4（210×297mm）</label></div><div className="form-row"><span className="form-label">向き</span><span>縦（固定）</span></div><label className="form-row"><span className="form-label">余白</span><select value={pageSettings.margin} onChange={(event) => setPageSettings({ ...pageSettings, margin: event.target.value as PageSettings["margin"] })}><option value="wide">広い（20mm）</option><option value="normal">標準（15mm）</option><option value="narrow">狭い（10mm）</option><option value="veryNarrow">かなり狭い（5mm）</option></select></label>{pageSettings.margin === "veryNarrow" && <p className="field-warning">プリンターによっては端が欠ける場合があります。欠ける場合は10mm以上を選択してください。</p>}</div>
    <div className="form-section"><h3>フォント / 小問番号</h3><label className="form-row"><span className="form-label">日本語フォント</span><select value={pageSettings.fontFamily} onChange={(event) => setPageSettings({ ...pageSettings, fontFamily: event.target.value as PageSettings["fontFamily"] })}><option value="biz-udp-gothic">BIZ UDPゴシック</option><option value="biz-ud-gothic">BIZ UDゴシック</option><option value="biz-udp-mincho">BIZ UDP明朝</option><option value="noto-sans-jp">Noto Sans JP</option><option value="noto-serif-jp">Noto Serif JP</option></select></label><label className="form-row"><span className="form-label">小問の番号形式</span><select value={pageSettings.subQuestionNumberFormat} onChange={(event) => setPageSettings({ ...pageSettings, subQuestionNumberFormat: event.target.value as PageSettings["subQuestionNumberFormat"] })}><option value="paren">(1)</option><option value="dot">1.</option><option value="circled">①</option><option value="kana">ア</option></select></label></div>
    <div className="form-section"><h3>ヘッダー</h3><div className="form-row"><span className="form-label">表示項目</span>{(["gradeField", "classField", "numberField", "nameField"] as const).map((key, index) => <label className="check-pill" key={key}><input type="checkbox" checked={header[key]} onChange={(event) => setHeader({ ...header, [key]: event.target.checked })} />{["年", "組", "番", "名前"][index]}</label>)}</div><p className="form-help">各出力セクションの1ページ目に題名と選択した項目を表示します。</p></div>
    <div className="manual-dialog-help"><ManualContextLink topic="worksheetSettings">プリント設定の詳しい使い方</ManualContextLink></div>
  </Modal>;
}

export function PdfDialog({ worksheet, initialMode, assetUrls, onClose, onDone }: { worksheet: Worksheet; initialMode: PreviewMode; assetUrls: Map<string, string>; onClose: () => void; onDone: (message: string) => void }) {
  const [mode, setMode] = useState(initialMode);
  const [status, setStatus] = useState<"idle" | "running" | "failed">("idle");
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(initialMode === "questionsAndAnswers" ? 2 : 1);
  const previewRef = useRef<HTMLDivElement>(null);
  const modes: Array<{ value: PreviewMode; title: string; description: string }> = [
    { value: "questions", title: "問題のみ", description: "生徒配布用。問題色と空の解答欄を表示します。" },
    { value: "withAnswers", title: "解答付き", description: "問題色と解答色、教師用の解説を表示します。" },
    { value: "questionsAndAnswers", title: "問題＋解答", description: "問題編の後、新しいページから解答編を出力します。" },
  ];
  useEffect(() => setPageCount(mode === "questionsAndAnswers" ? 2 : 1), [mode]);
  const download = async () => {
    setStatus("running"); setError("");
    try {
      const { generateWorksheetPdf } = await import("../../application/pdf/generate-pdf");
      await waitForPagination(previewRef.current);
      const pages = Array.from(previewRef.current?.querySelectorAll<HTMLElement>("[data-preview-page=\"true\"]") ?? []);
      const blob = await generateWorksheetPdf(worksheet, pages);
      const label = modes.find((item) => item.value === mode)!.title;
      downloadBlob(blob, `${sanitizeFileNamePart(worksheet.title)}_${label}_${localTimestamp()}.pdf`);
      onDone("PDFをダウンロードしました"); onClose();
    } catch (reason) { setStatus("failed"); setError(reason instanceof Error ? reason.message : "PDFを生成できませんでした"); }
  };
  return <>
    <Modal title="PDF出力" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={status === "running"} onClick={download}>{status === "running" ? "PDFを生成中…" : "PDFをダウンロード"}</button></>}>
      <div className="radio-cards">{modes.map((item) => <label className={mode === item.value ? "radio-card selected" : "radio-card"} key={item.value}><input type="radio" checked={mode === item.value} onChange={() => setMode(item.value)} /><span><strong>{item.title}</strong><small>{item.description}</small></span></label>)}</div>
      <div className="pdf-meta"><span>用紙: {worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"} / 縦</span><span>ページ数: {pageCount}ページ</span></div>
      <div className="notice info">ダウンロードしたPDFをChrome、EdgeまたはPDF閲覧ソフトで開き、用紙サイズをPDFと同じにして、倍率を「実際のサイズ／100%」で印刷してください。</div>
      <div className="manual-dialog-help"><ManualContextLink topic="pdf">PDF出力の詳しい使い方</ManualContextLink></div>
      {error && <div className="notice danger" role="alert">{error}</div>}
    </Modal>
    <div className="pdf-render-source" ref={previewRef} aria-hidden="true">
      <WorksheetPreview worksheet={worksheet} mode={mode} zoom={1} assetUrls={assetUrls} onPageCountChange={setPageCount} />
    </div>
  </>;
}

async function waitForPagination(previewRoot: HTMLElement | null): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (previewRoot?.querySelector<HTMLElement>(".preview-pages")?.dataset.paginationReady !== "true") {
    if (Date.now() >= deadline) throw new Error("PDFのページ分割を完了できませんでした");
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

type MathDialogInitial = { latex: string; block: boolean; textSize: MathTextSize };

type MathfieldHandle = HTMLElement & {
  value: string;
  insert: (latex: string, options?: {
    selectionMode?: "placeholder" | "after" | "before" | "item";
    focus?: boolean;
    scrollIntoView?: boolean;
  }) => boolean;
};

const mathSymbols = [
  { latex: "+", preview: "+", label: "たし算" },
  { latex: "-", preview: "-", label: "ひき算" },
  { latex: "\\times", preview: "\\times", label: "かけ算" },
  { latex: "\\div", preview: "\\div", label: "わり算" },
  { latex: "=", preview: "=", label: "等号" },
  { latex: "\\ne", preview: "\\ne", label: "等しくない" },
  { latex: "\\pm", preview: "\\pm", label: "プラスマイナス" },
  { latex: "\\frac{}{}", insertLatex: "\\frac{#0}{#?}", preview: "\\frac{a}{b}", label: "分数" },
  { latex: "\\sqrt{}", insertLatex: "\\sqrt{#0}", preview: "\\sqrt{x}", label: "平方根" },
  { latex: "x^2", preview: "x^2", label: "2乗" },
  { latex: "\\leqq", preview: "\\leqq", label: "小なりイコール" },
  { latex: "\\geqq", preview: "\\geqq", label: "大なりイコール" },
] as const;

export function MathDialog({ onClose, onInsert, inlineOnly = false, initial }: { onClose: () => void; onInsert: (latex: string, block: boolean, textSize: MathTextSize) => void; inlineOnly?: boolean; initial?: MathDialogInitial }) {
  const editing = Boolean(initial);
  const [latex, setLatex] = useState(initial?.latex ?? "2x + 3 = 9");
  const [block, setBlock] = useState(initial?.block ?? false);
  const [textSize, setTextSize] = useState<MathTextSize>(initial?.textSize ?? "normal");
  const mathfieldRef = useRef<MathfieldHandle | null>(null);
  useEffect(() => {
    void import("mathlive");
  }, []);
  return <Modal title={editing ? "数式を編集" : inlineOnly ? "表セルに数式を挿入" : "数式を入力"} size="large" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!latex.trim()} onClick={() => onInsert(latex.trim(), inlineOnly ? false : block, textSize)}>{editing ? "変更を保存" : "挿入"}</button></>}>
    <div className="dialog-lead"><Sigma size={20} /><span>基本、分数・指数、平方根、不等号の記号を選択できます。</span></div>
    <div className="manual-dialog-help"><ManualContextLink topic="formula">数式入力の詳しい使い方</ManualContextLink></div>
    <div className="symbol-grid">{mathSymbols.map((symbol) => <button key={symbol.latex} type="button" aria-label={`${symbol.label}を挿入`} title={symbol.label} onClick={() => { const mathfield = mathfieldRef.current; if (mathfield) { const insertLatex = "insertLatex" in symbol ? symbol.insertLatex : symbol.latex; mathfield.focus(); mathfield.insert(insertLatex, { selectionMode: "placeholder", focus: true, scrollIntoView: true }); setLatex(mathfield.value); } else setLatex((value) => `${value}${symbol.latex}`); }}><MathFormula latex={symbol.preview} /></button>)}</div>
    <label className="stacked-field"><span>数式</span>{createElement("math-field", { ref: mathfieldRef, value: latex, onInput: (event: Event) => setLatex((event.currentTarget as HTMLElement & { value: string }).value), "aria-label": "数式を視覚的に入力" })}</label>
    <div className="math-preview">{latex ? <MathFormula latex={latex} block textSize={textSize} /> : "数式プレビュー"}</div>
    <label className="form-row"><span className="form-label">文字サイズ</span><select aria-label="数式の文字サイズ" value={textSize} onChange={(event) => setTextSize(event.target.value as MathTextSize)}><option value="small">小</option><option value="normal">標準</option><option value="large">大</option><option value="xLarge">特大</option></select></label>
    {inlineOnly
      ? <p className="math-inline-note">表セルには行内数式として挿入します。</p>
      : editing
        ? <p className="math-inline-note">表示形式: {block ? "独立数式" : "行内数式"}（編集時は元の形式を維持します）</p>
        : <div className="segmented"><button className={!block ? "active" : ""} onClick={() => setBlock(false)}>行内数式</button><button className={block ? "active" : ""} onClick={() => setBlock(true)}>独立数式</button></div>}
  </Modal>;
}

export function TableDialog({ onClose, onInsert }: { onClose: () => void; onInsert: (table: ReturnType<typeof createTableBlock>) => void }) {
  const [template, setTemplate] = useState<"general" | "function" | "frequency">("general");
  const [rows, setRows] = useState(3); const [columns, setColumns] = useState(4);
  const selectTemplate = (value: typeof template) => {
    setTemplate(value);
    if (value === "general") { setRows(3); setColumns(4); }
    else if (value === "function") { setRows(2); setColumns(4); }
    else { setRows(3); setColumns(2); }
  };
  return <Modal title="表を挿入" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" onClick={() => onInsert(createTableBlock(rows, columns, template))}>挿入</button></>}>
    <div className="dialog-lead"><Table2 size={20} /><span>表は挿入後もセルを直接編集できます。</span></div>
    <div className="manual-dialog-help"><ManualContextLink topic="table">表の詳しい使い方</ManualContextLink></div>
    <div className="form-row"><span className="form-label">テンプレート</span>{(["general", "function", "frequency"] as const).map((value) => <label key={value}><input type="radio" checked={template === value} onChange={() => selectTemplate(value)} />{{ general: "一般", function: "関数", frequency: "度数分布" }[value]}</label>)}</div>
    <div className="form-row"><label>行数（1～20）<input type="number" min={1} max={20} value={rows} onChange={(event) => setRows(clampTableSize(event.target.valueAsNumber))} /></label><label>列数（1～20）<input type="number" min={1} max={20} value={columns} onChange={(event) => setColumns(clampTableSize(event.target.valueAsNumber))} /></label></div>
    <TablePreview rows={rows} columns={columns} template={template} />
  </Modal>;
}

type ImageDialogInitial = {
  placement: ImagePlacement;
  widthPercent: ImageWidthPercent;
  alt: string;
  previewUrl?: string;
};

export function ImageDialog({ worksheetId, initial, onClose, onApply }: { worksheetId: string; initial?: ImageDialogInitial; onClose: () => void; onApply: (asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null); const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [placement, setPlacement] = useState<ImagePlacement>(initial?.placement ?? "block"); const [width, setWidth] = useState<ImageWidthPercent>(initial?.widthPercent ?? 50); const [alt, setAlt] = useState(initial?.alt ?? ""); const [error, setError] = useState("");
  const replacementPreviewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { if (replacementPreviewUrl) URL.revokeObjectURL(replacementPreviewUrl); }, [replacementPreviewUrl]);
  const previewUrl = replacementPreviewUrl || initial?.previewUrl || "";
  const choose = async (next?: File) => {
    setError(""); setDimensions(null);
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) { setError("PNG、JPEG、WebPの画像を選択してください。"); return; }
    if (next.size > 10 * 1024 * 1024) { setError("画像は1点10MiB以下にしてください。"); return; }
    try {
      const bitmap = await createImageBitmap(next);
      if (bitmap.width > 10000 || bitmap.height > 10000 || bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); setError("画像寸法の上限を超えています。"); return; }
      setDimensions({ width: bitmap.width, height: bitmap.height }); bitmap.close(); setFile(next);
    } catch { setError("画像を読み込めませんでした。"); }
  };
  const invalidFloat = placement !== "block" && width > 50;
  const invalidFile = Boolean(error) || Boolean(file && !dimensions);
  const apply = () => {
    if (invalidFloat || invalidFile || (!initial && (!file || !dimensions))) return;
    const asset = file && dimensions ? { id: createId(), worksheetId, mimeType: file.type as AssetRecord["mimeType"], blob: file, width: dimensions.width, height: dimensions.height, createdAt: new Date().toISOString() } : null;
    onApply(asset, placement, width, alt);
  };
  const editing = Boolean(initial);
  return <Modal title={editing ? "画像を編集" : "画像を挿入"} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={invalidFloat || invalidFile || (!initial && (!file || !dimensions))} onClick={apply}>{editing ? "変更を保存" : "挿入"}</button></>}>
    <div className="drop-zone" onClick={() => inputRef.current?.click()}><Upload size={25} /><strong>{editing ? "別の画像に差し替える" : "ファイルを選択"}</strong><span>{editing ? "未選択の場合は現在の画像を使用" : "PNG / JPEG / WebP"}</span><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void choose(event.target.files?.[0])} /></div>
    {previewUrl && <div className="image-preview"><img src={previewUrl} alt={editing ? "現在の画像のプレビュー" : "挿入画像のプレビュー"} /></div>}
    {editing && !previewUrl && <div className="image-preview image-preview-missing">現在の画像を読み込めません</div>}
    {error && <div className="notice danger">{error}</div>}
    <div className="form-row"><span className="form-label">配置</span>{(["block", "floatLeft", "floatRight"] as const).map((value) => <label key={value}><input type="radio" checked={placement === value} onChange={() => setPlacement(value)} />{{ block: "独立", floatLeft: "左回り込み", floatRight: "右回り込み" }[value]}</label>)}</div>
    <label className="form-row"><span className="form-label">サイズ</span><select value={width} onChange={(event) => setWidth(Number(event.target.value) as ImageWidthPercent)}>{[25, 33, 50, 66, 75, 100].map((value) => <option key={value} value={value} disabled={placement !== "block" && value > 50}>{value}%</option>)}</select></label>
    {invalidFloat && <p className="field-warning">回り込みでは50%以下を選択してください。</p>}
    <label className="form-row"><span className="form-label">代替テキスト</span><input value={alt} onChange={(event) => setAlt(event.target.value)} /></label>
    <p className="form-help">縦長画像は縦横比を維持して1ページ内へ自動縮小します。</p>
    <div className="manual-dialog-help"><ManualContextLink topic="image">画像の詳しい使い方</ManualContextLink></div>
  </Modal>;
}

function TablePreview({ rows, columns, template }: { rows: number; columns: number; template: string }) {
  return <div className="table-dialog-preview"><div className="preview-label">プレビュー</div><table><tbody>{Array.from({ length: Math.min(rows, 6) }, (_, row) => <tr key={row}>{Array.from({ length: Math.min(columns, 8) }, (_, column) => <td key={column}>{template === "function" && column === 0 ? (row === 0 ? "x" : row === 1 ? "y" : "") : template === "frequency" && row === 0 ? (column === 0 ? "階級" : column === 1 ? "度数" : "") : ""}</td>)}</tr>)}</tbody></table></div>;
}

const clampTableSize = (value: number) => Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 1;
