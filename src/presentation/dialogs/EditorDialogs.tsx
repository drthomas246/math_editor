import { Sigma, Table2, Upload } from "lucide-react";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { validateImageBlob } from "../../application/assets/image-validation";
import type { PreviewMode } from "../../application/pdf/generate-pdf";
import type { AssetRecord, ImagePlacement, ImageWidthPercent, PageSettings, Worksheet, WorksheetHeader } from "../../domain/worksheet/worksheet";
import { createId, createTableBlock } from "../../domain/worksheet/worksheet.defaults";
import { downloadBlob, localTimestamp, sanitizeFileNamePart } from "../../infrastructure/file/download";
import { MathFormula } from "../components/MathFormula";
import { ManualContextLink } from "../components/ManualContextLink";
import { mathMacros } from "../components/math-macros";
import type { MathTextSize } from "../components/rich-text-editor-extensions";
import { Modal } from "../components/Modal";
import { WorksheetPreview } from "../preview/WorksheetPreview";
/**
 * WorksheetSettingsDialogコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function WorksheetSettingsDialog(props: {
    worksheet: Worksheet;
    onClose: () => void;
    onApply: (pageSettings: PageSettings, header: Omit<WorksheetHeader, "title">) => void;
}) {
    let { worksheet, onClose, onApply } = props;
    const [pageSettings, setPageSettings] = useState((/**
     * useStateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useStateCallback1() {
        return structuredClone(worksheet.pageSettings);
    }));
    const [header, setHeader] = useState((/**
     * useStateへ渡す処理を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function useStateCallback2() {
        return structuredClone(worksheet.header);
    }));
    return <Modal title="プリント設定" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick3() {
        return onApply(pageSettings, { gradeField: header.gradeField, classField: header.classField, numberField: header.numberField, nameField: header.nameField, firstPageOnly: true });
    })}>適用</button></>}>
    <div className="form-section"><h3>用紙</h3><div className="form-row"><span className="form-label">サイズ</span><label><input type="radio" checked={pageSettings.size === "B5"} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange4() {
        return setPageSettings({ ...pageSettings, size: "B5" });
    })}/> JIS B5（182×257mm）</label><label><input type="radio" checked={pageSettings.size === "A4"} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange5() {
        return setPageSettings({ ...pageSettings, size: "A4" });
    })}/> A4（210×297mm）</label></div><div className="form-row"><span className="form-label">向き</span><span>縦（固定）</span></div><label className="form-row"><span className="form-label">余白</span><select value={pageSettings.margin} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange6(event) {
        return setPageSettings({ ...pageSettings, margin: event.target.value as PageSettings["margin"] });
    })}><option value="wide">広い（20mm）</option><option value="normal">標準（15mm）</option><option value="narrow">狭い（10mm）</option><option value="veryNarrow">かなり狭い（5mm）</option></select></label>{pageSettings.margin === "veryNarrow" && <p className="field-warning">プリンターによっては端が欠ける場合があります。欠ける場合は10mm以上を選択してください。</p>}</div>
    <div className="form-section"><h3>フォント / 小問番号</h3><label className="form-row"><span className="form-label">日本語フォント</span><select value={pageSettings.fontFamily} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange7(event) {
        return setPageSettings({ ...pageSettings, fontFamily: event.target.value as PageSettings["fontFamily"] });
    })}><option value="biz-udp-gothic">BIZ UDPゴシック</option><option value="biz-ud-gothic">BIZ UDゴシック</option><option value="biz-udp-mincho">BIZ UDP明朝</option><option value="noto-sans-jp">Noto Sans JP</option><option value="noto-serif-jp">Noto Serif JP</option></select></label><label className="form-row"><span className="form-label">小問の番号形式</span><select value={pageSettings.subQuestionNumberFormat} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange8(event) {
        return setPageSettings({ ...pageSettings, subQuestionNumberFormat: event.target.value as PageSettings["subQuestionNumberFormat"] });
    })}><option value="paren">(1)</option><option value="dot">1.</option><option value="circled">①</option><option value="kana">ア</option></select></label></div>
    <div className="form-section"><h3>ヘッダー</h3><div className="form-row"><span className="form-label">表示項目</span>{(["gradeField", "classField", "numberField", "nameField"] as const).map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param key keyとして使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem9(key, index) {
        return <label className="check-pill" key={key}><input type="checkbox" checked={header[key]} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @param event 発生したイベント
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange10(event) {
            return setHeader({ ...header, [key]: event.target.checked });
        })}/>{["年", "組", "番", "名前"][index]}</label>;
    }))}</div><p className="form-help">各出力セクションの1ページ目に題名と選択した項目を表示します。</p></div>
    <div className="manual-dialog-help"><ManualContextLink topic="worksheetSettings">プリント設定の詳しい使い方</ManualContextLink></div>
  </Modal>;
}
/**
 * PdfDialogコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function PdfDialog(props: {
    worksheet: Worksheet;
    initialMode: PreviewMode;
    assetUrls: Map<string, string>;
    onClose: () => void;
    onDone: (message: string) => void;
}) {
    let { worksheet, initialMode, assetUrls, onClose, onDone } = props;
    const [mode, setMode] = useState(initialMode);
    const [status, setStatus] = useState<"idle" | "running" | "failed">("idle");
    const [error, setError] = useState("");
    const [paginationError, setPaginationError] = useState<string | null>(null);
    const [paginationReady, setPaginationReady] = useState(false);
    const [pageCount, setPageCount] = useState(initialMode === "questionsAndAnswers" ? 2 : 1);
    const previewRef = useRef<HTMLDivElement>(null);
    const modes: Array<{
        value: PreviewMode;
        title: string;
        description: string;
    }> = [
        { value: "questions", title: "問題のみ", description: "生徒配布用。問題色と空の解答欄を表示します。" },
        { value: "withAnswers", title: "解答付き", description: "問題色と解答色、教師用の解説を表示します。" },
        { value: "questionsAndAnswers", title: "問題＋解答", description: "問題編の後、新しいページから解答編を出力します。" },
    ];
    const selectMode = (/**
     * selectModeで必要な値を取得する。
     *
     * @param nextMode nextModeとして使用する値
     */
    function selectModeImplementation11(nextMode: PreviewMode) {
        setMode(nextMode);
        setPaginationReady(false);
        setPageCount(nextMode === "questionsAndAnswers" ? 2 : 1);
        setPaginationError(null);
        setError("");
    });
    const download = (/**
     * downloadの対象となるデータを保存または出力する。
     *
     * @returns 非同期処理の結果
     */
    async function downloadImplementation12() {
        setStatus("running");
        setError("");
        try {
            const { generateWorksheetPdf } = await import("../../application/pdf/generate-pdf");
            const pages = Array.from(previewRef.current?.querySelectorAll<HTMLElement>("[data-preview-page=\"true\"]") ?? []);
            const blob = await generateWorksheetPdf(worksheet, pages);
            const label = modes.find((/**
             * 検索条件に一致する要素か判定する。
             *
             * @param item 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function findItem13(item) {
                return item.value === mode;
            }))!.title;
            downloadBlob(blob, `${sanitizeFileNamePart(worksheet.title)}_${label}_${localTimestamp()}.pdf`);
            onDone("PDFをダウンロードしました");
            onClose();
        }
        catch (reason) {
            setStatus("failed");
            setError(reason instanceof Error ? reason.message : "PDFを生成できませんでした");
        }
    });
    return <>
    <Modal title="PDF出力" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={status === "running" || !paginationReady || Boolean(paginationError)} onClick={download}>{status === "running" ? "PDFを生成中…" : "PDFをダウンロード"}</button></>}>
      <div className="radio-cards">{modes.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param item 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem14(item) {
        return <label className={mode === item.value ? "radio-card selected" : "radio-card"} key={item.value}><input type="radio" checked={mode === item.value} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange15() {
            return selectMode(item.value);
        })}/><span><strong>{item.title}</strong><small>{item.description}</small></span></label>;
    }))}</div>
      <div className="pdf-meta"><span>用紙: {worksheet.pageSettings.size === "B5" ? "JIS B5" : "A4"} / 縦</span><span aria-live="polite">{paginationReady ? `ページ数: ${pageCount}ページ` : "ページを分割中…"}</span></div>
      <div className="notice info">ダウンロードしたPDFをChrome、EdgeまたはPDF閲覧ソフトで開き、用紙サイズをPDFと同じにして、倍率を「実際のサイズ／100%」で印刷してください。</div>
      <div className="manual-dialog-help"><ManualContextLink topic="pdf">PDF出力の詳しい使い方</ManualContextLink></div>
      {(error || paginationError) && <div className="notice danger" role="alert">{error || paginationError}</div>}
    </Modal>
    <div className="pdf-render-source" ref={previewRef} aria-hidden="true">
      <WorksheetPreview worksheet={worksheet} mode={mode} zoom={1} assetUrls={assetUrls} onPageCountChange={setPageCount} onPaginationErrorChange={setPaginationError} onPaginationReadyChange={setPaginationReady}/>
    </div>
  </>;
}
type MathDialogInitial = {
    latex: string;
    block: boolean;
    textSize: MathTextSize;
};
type MathfieldHandle = HTMLElement & {
    value: string;
    macros: Readonly<Record<string, unknown>>;
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
/**
 * MathDialogコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function MathDialog(props: {
    onClose: () => void;
    onInsert: (latex: string, block: boolean, textSize: MathTextSize) => void;
    inlineOnly?: boolean;
    initial?: MathDialogInitial;
}) {
    let { onClose, onInsert, inlineOnly = false, initial } = props;
    const editing = Boolean(initial);
    const [latex, setLatex] = useState(initial?.latex ?? "2x + 3 = 9");
    const [block, setBlock] = useState(initial?.block ?? false);
    const [textSize, setTextSize] = useState<MathTextSize>(initial?.textSize ?? "normal");
    const mathfieldRef = useRef<MathfieldHandle | null>(null);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect16() {
        let active = true;
        void import("mathlive").then((/**
         * 非同期処理が成功した結果を反映する。
         */
        function handleResolvedValue17() {
            const mathfield = mathfieldRef.current;
            if (!active || !mathfield)
                return;
            const currentValue = mathfield.value;
            mathfield.macros = { ...mathfield.macros, ...mathMacros };
            mathfield.value = "";
            mathfield.value = currentValue;
        }));
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback18() { active = false; });
    }), []);
    return <Modal title={editing ? "数式を編集" : inlineOnly ? "表セルに数式を挿入" : "数式を入力"} size="large" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={!latex.trim()} onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick19() {
        return onInsert(latex.trim(), inlineOnly ? false : block, textSize);
    })}>{editing ? "変更を保存" : "挿入"}</button></>}>
    <div className="dialog-lead"><Sigma size={20}/><span>基本、分数・指数、平方根、不等号の記号を選択できます。</span></div>
    <div className="manual-dialog-help"><ManualContextLink topic="formula">数式入力の詳しい使い方</ManualContextLink></div>
    <div className="symbol-grid">{mathSymbols.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param symbol symbolとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem20(symbol) {
        return <button key={symbol.latex} type="button" aria-label={`${symbol.label}を挿入`} title={symbol.label} onClick={(/**
         * onClickで発生した画面イベントを処理する。
         */
        function handleClick21() { const mathfield = mathfieldRef.current; if (mathfield && typeof mathfield.insert === "function") {
            const insertLatex = "insertLatex" in symbol ? symbol.insertLatex : symbol.latex;
            mathfield.focus();
            mathfield.insert(insertLatex, { selectionMode: "placeholder", focus: true, scrollIntoView: true });
            setLatex(mathfield.value);
        }
        else
            setLatex((/**
             * setLatexへ渡す処理を実行する。
             *
             * @param value 処理対象の値
             * @returns 呼び出し元で使用する処理結果
             */
            function setLatexCallback22(value) {
                return `${value}${symbol.latex}`;
            })); })}><MathFormula latex={symbol.preview}/></button>;
    }))}</div>
    <label className="stacked-field"><span>数式</span>{createElement("math-field", { ref: mathfieldRef, value: latex, onInput: (/**
         * onInputに対応するイベントまたは通知を処理する。
         *
         * @param event 発生したイベント
         * @returns 呼び出し元で使用する処理結果
         */
        function onInputCallback23(event: Event) {
            return setLatex((event.currentTarget as HTMLElement & {
                value: string;
            }).value);
        }), "aria-label": "数式を視覚的に入力" })}</label>
    <div className="math-preview">{latex ? <MathFormula latex={latex} block textSize={textSize}/> : "数式プレビュー"}</div>
    <label className="form-row"><span className="form-label">文字サイズ</span><select aria-label="数式の文字サイズ" value={textSize} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange24(event) {
        return setTextSize(event.target.value as MathTextSize);
    })}><option value="small">小</option><option value="normal">標準</option><option value="large">大</option><option value="xLarge">特大</option></select></label>
    {inlineOnly
            ? <p className="math-inline-note">表セルには行内数式として挿入します。</p>
            : editing
                ? <p className="math-inline-note">表示形式: {block ? "独立数式" : "行内数式"}（編集時は元の形式を維持します）</p>
                : <div className="segmented"><button className={!block ? "active" : ""} onClick={(/**
                 * onClickで発生した画面イベントを処理する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleClick25() {
                    return setBlock(false);
                })}>行内数式</button><button className={block ? "active" : ""} onClick={(/**
                 * onClickで発生した画面イベントを処理する。
                 *
                 * @returns 呼び出し元で使用する処理結果
                 */
                function handleClick26() {
                    return setBlock(true);
                })}>独立数式</button></div>}
  </Modal>;
}
/**
 * TableDialogコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function TableDialog(props: {
    onClose: () => void;
    onInsert: (table: ReturnType<typeof createTableBlock>) => void;
}) {
    let { onClose, onInsert } = props;
    const [template, setTemplate] = useState<"general" | "function" | "frequency">("general");
    const [rows, setRows] = useState(3);
    const [columns, setColumns] = useState(4);
    const selectTemplate = (/**
     * selectTemplateで必要な値を取得する。
     *
     * @param value 処理対象の値
     */
    function selectTemplateImplementation27(value: typeof template) {
        setTemplate(value);
        if (value === "general") {
            setRows(3);
            setColumns(4);
        }
        else if (value === "function") {
            setRows(2);
            setColumns(4);
        }
        else {
            setRows(3);
            setColumns(2);
        }
    });
    return <Modal title="表を挿入" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick28() {
        return onInsert(createTableBlock(rows, columns, template));
    })}>挿入</button></>}>
    <div className="dialog-lead"><Table2 size={20}/><span>表は挿入後もセルを直接編集できます。</span></div>
    <div className="manual-dialog-help"><ManualContextLink topic="table">表の詳しい使い方</ManualContextLink></div>
    <div className="form-row"><span className="form-label">テンプレート</span>{(["general", "function", "frequency"] as const).map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param value 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem29(value) {
        return <label key={value}><input type="radio" checked={template === value} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange30() {
            return selectTemplate(value);
        })}/>{{ general: "一般", function: "関数", frequency: "度数分布" }[value]}</label>;
    }))}</div>
    <div className="form-row"><label>行数（1～20）<input type="number" min={1} max={20} value={rows} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange31(event) {
        return setRows(clampTableSize(event.target.valueAsNumber));
    })}/></label><label>列数（1～20）<input type="number" min={1} max={20} value={columns} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange32(event) {
        return setColumns(clampTableSize(event.target.valueAsNumber));
    })}/></label></div>
    <TablePreview rows={rows} columns={columns} template={template}/>
  </Modal>;
}
type ImageDialogInitial = {
    placement: ImagePlacement;
    widthPercent: ImageWidthPercent;
    alt: string;
    previewUrl?: string;
};
/**
 * ImageDialogコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function ImageDialog(props: {
    worksheetId: string;
    initial?: ImageDialogInitial;
    onClose: () => void;
    onApply: (asset: AssetRecord | null, placement: ImagePlacement, width: ImageWidthPercent, alt: string) => void;
}) {
    let { worksheetId, initial, onClose, onApply } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const validationSequenceRef = useRef(0);
    const [file, setFile] = useState<File | null>(null);
    const [dimensions, setDimensions] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const [placement, setPlacement] = useState<ImagePlacement>(initial?.placement ?? "block");
    const [width, setWidth] = useState<ImageWidthPercent>(initial?.widthPercent ?? 50);
    const [alt, setAlt] = useState(initial?.alt ?? "");
    const [error, setError] = useState("");
    const replacementPreviewUrl = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue33() {
        return file ? URL.createObjectURL(file) : "";
    }), [file]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeEffect34() {
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback35() { if (replacementPreviewUrl)
            URL.revokeObjectURL(replacementPreviewUrl); });
    }), [replacementPreviewUrl]);
    const previewUrl = replacementPreviewUrl || initial?.previewUrl || "";
    const choose = (/**
     * chooseに必要な処理を実行する。
     *
     * @param next nextとして使用する値
     * @returns 非同期処理の結果
     */
    async function chooseImplementation36(next?: File) {
        const validationSequence = ++validationSequenceRef.current;
        setError("");
        setDimensions(null);
        if (!next)
            return;
        try {
            const nextDimensions = await validateImageBlob(next);
            if (validationSequence !== validationSequenceRef.current)
                return;
            setDimensions(nextDimensions);
            setFile(next);
        }
        catch (reason) {
            if (validationSequence !== validationSequenceRef.current)
                return;
            setError(reason instanceof Error ? reason.message : "画像を読み込めませんでした。");
        }
    });
    const invalidFloat = placement !== "block" && width > 50;
    const invalidFile = Boolean(error) || Boolean(file && !dimensions);
    const apply = (/**
     * applyの対象となる状態を更新する。
     */
    function applyImplementation37() {
        if (invalidFloat || invalidFile || (!initial && (!file || !dimensions)))
            return;
        const asset = file && dimensions ? { id: createId(), worksheetId, mimeType: file.type as AssetRecord["mimeType"], blob: file, width: dimensions.width, height: dimensions.height, createdAt: new Date().toISOString() } : null;
        onApply(asset, placement, width, alt);
    });
    const editing = Boolean(initial);
    return <Modal title={editing ? "画像を編集" : "画像を挿入"} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button" disabled={invalidFloat || invalidFile || (!initial && (!file || !dimensions))} onClick={apply}>{editing ? "変更を保存" : "挿入"}</button></>}>
    <div className="drop-zone" onClick={(/**
     * onClickで発生した画面イベントを処理する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function handleClick38() {
        return inputRef.current?.click();
    })}><Upload size={25}/><strong>{editing ? "別の画像に差し替える" : "ファイルを選択"}</strong><span>{editing ? "未選択の場合は現在の画像を使用" : "PNG / JPEG / WebP"}</span><input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange39(event) {
        return void choose(event.target.files?.[0]);
    })}/></div>
    {previewUrl && <div className="image-preview"><img src={previewUrl} alt={editing ? "現在の画像のプレビュー" : "挿入画像のプレビュー"}/></div>}
    {editing && !previewUrl && <div className="image-preview image-preview-missing">現在の画像を読み込めません</div>}
    {error && <div className="notice danger">{error}</div>}
    <div className="form-row"><span className="form-label">配置</span>{(["block", "floatLeft", "floatRight"] as const).map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param value 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem40(value) {
        return <label key={value}><input type="radio" checked={placement === value} onChange={(/**
         * onChangeで発生した画面イベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleChange41() {
            return setPlacement(value);
        })}/>{{ block: "独立", floatLeft: "左回り込み", floatRight: "右回り込み" }[value]}</label>;
    }))}</div>
    <label className="form-row"><span className="form-label">サイズ</span><select value={width} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange42(event) {
        return setWidth(Number(event.target.value) as ImageWidthPercent);
    })}>{[25, 33, 50, 66, 75, 100].map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param value 処理対象の値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem43(value) {
        return <option key={value} value={value} disabled={placement !== "block" && value > 50}>{value}%</option>;
    }))}</select></label>
    {invalidFloat && <p className="field-warning">回り込みでは50%以下を選択してください。</p>}
    <label className="form-row"><span className="form-label">代替テキスト</span><input value={alt} onChange={(/**
     * onChangeで発生した画面イベントを処理する。
     *
     * @param event 発生したイベント
     * @returns 呼び出し元で使用する処理結果
     */
    function handleChange44(event) {
        return setAlt(event.target.value);
    })}/></label>
    <p className="form-help">縦長画像は縦横比を維持して1ページ内へ自動縮小します。</p>
    <div className="manual-dialog-help"><ManualContextLink topic="image">画像の詳しい使い方</ManualContextLink></div>
  </Modal>;
}
/**
 * TablePreviewコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function TablePreview(props: {
    rows: number;
    columns: number;
    template: string;
}) {
    let { rows, columns, template } = props;
    return <div className="table-dialog-preview"><div className="preview-label">プレビュー</div><table><tbody>{Array.from({ length: Math.min(rows, 6) }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param row rowとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback45(_, row) {
        return <tr key={row}>{Array.from({ length: Math.min(columns, 8) }, (/**
         * fromへ渡す処理を実行する。
         *
         * @param _ _として使用する値
         * @param column columnとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback46(_, column) {
            return <td key={column}>{template === "function" && column === 0 ? (row === 0 ? "x" : row === 1 ? "y" : "") : template === "frequency" && row === 0 ? (column === 0 ? "階級" : column === 1 ? "度数" : "") : ""}</td>;
        }))}</tr>;
    }))}</tbody></table></div>;
}
const clampTableSize = (/**
 * clampTableSizeに必要な処理を実行する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function clampTableSizeImplementation47(value: number) {
    return Number.isFinite(value) ? Math.max(1, Math.min(20, Math.round(value))) : 1;
});
