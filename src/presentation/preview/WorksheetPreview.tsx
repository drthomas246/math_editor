import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { MARGINS_MM, PAGE_SIZES_MM } from "../../domain/worksheet/page-tokens";
import { colorDocumentAsAnswer, hasVisibleDocument, mergeColoredDocuments, nodeUsesAnswerColor } from "../../domain/worksheet/rich-text";
import type { AnswerArea as AnswerAreaValue, ContentBlock, ProblemBlock, SubQuestionNumberFormat, TableRow, Worksheet } from "../../domain/worksheet/worksheet";
import { formatProblemHeading, getProblemNumbers, getSubQuestionNumbers } from "../../domain/worksheet/worksheet.numbering";
import type { PreviewMode } from "../../application/pdf/generate-pdf";
import { MathFormula } from "../components/MathFormula";
import { paginateMeasuredItems } from "./pagination";

type Props = {
  worksheet: Worksheet;
  mode: PreviewMode;
  zoom: number;
  assetUrls: Map<string, string>;
  onPageCountChange?: (pageCount: number) => void;
};

type SectionMode = "questions" | "withAnswers";
type RenderAtom = {
  key: string;
  problem: ProblemBlock;
  number: string | null;
  content: ContentBlock | null;
  showSolution: boolean;
  showSolutionHeading: boolean;
  startsProblem: boolean;
  breakBefore: boolean;
  breakAfter: boolean;
};
type PreviewSection = { mode: SectionMode; atoms: RenderAtom[] };
type PlannedPage = { mode: SectionMode; sectionPageIndex: number; atomKeys: string[] };

export function WorksheetPreview({ worksheet, mode, zoom, assetUrls, onPageCountChange }: Props) {
  const numbers = useMemo(() => getProblemNumbers(worksheet), [worksheet]);
  const sectionModes = mode === "questionsAndAnswers"
    ? (["questions", "withAnswers"] as const)
    : ([mode] as const);
  const sectionModeKey = sectionModes.join("|");
  const sections = useMemo<PreviewSection[]>(
    () => sectionModes.map((sectionMode) => ({ mode: sectionMode, atoms: createRenderAtoms(worksheet, sectionMode, numbers) })),
    [numbers, sectionModeKey, worksheet],
  );
  const measurementRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState<{ ready: boolean; pages: PlannedPage[] }>({ ready: false, pages: fallbackPages(sections) });

  useLayoutEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    const measurementRoot = measurementRef.current;
    if (!measurementRoot) return;

    setPagination((current) => ({ ...current, ready: false }));
    const measure = () => {
      if (!cancelled) setPagination({ ready: true, pages: measurePages(measurementRoot, sections) });
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(measure);
    };
    const prepare = async () => {
      await document.fonts?.ready;
      await Promise.all(Array.from(measurementRoot.querySelectorAll("img")).map(waitForImage));
      scheduleMeasure();
    };

    void prepare();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
    measurementRoot.querySelectorAll(".paper-header, [data-pagination-atom]").forEach((element) => resizeObserver?.observe(element));

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
    };
  }, [sections, worksheet.pageSettings.margin, worksheet.pageSettings.size]);

  const displayedPages = pagination.ready ? pagination.pages : fallbackPages(sections);
  useEffect(() => {
    if (pagination.ready) onPageCountChange?.(displayedPages.length);
  }, [displayedPages.length, onPageCountChange, pagination.ready]);
  const atomLookup = new Map(sections.flatMap((section) => section.atoms).map((atom) => [atom.key, atom]));

  return <div className="preview-pages" data-pagination-ready={pagination.ready ? "true" : "false"} style={{ "--preview-zoom": zoom } as React.CSSProperties}>
    {displayedPages.map((page, pageIndex) => <Fragment key={`${page.mode}:${page.sectionPageIndex}`}>
      <PreviewPage worksheet={worksheet} mode={page.mode} atoms={page.atomKeys.flatMap((key) => atomLookup.get(key) ?? [])} assetUrls={assetUrls} showHeader={page.sectionPageIndex === 0} pageNumber={pageIndex + 1} totalPages={displayedPages.length} />
    </Fragment>)}
    <div className="preview-measurement" ref={measurementRef} aria-hidden="true">
      {sections.map((section) => <MeasurementPage key={section.mode} worksheet={worksheet} section={section} assetUrls={assetUrls} />)}
    </div>
  </div>;
}

function PreviewPage({ worksheet, mode, atoms, assetUrls, showHeader, pageNumber, totalPages }: { worksheet: Worksheet; mode: SectionMode; atoms: RenderAtom[]; assetUrls: Map<string, string>; showHeader: boolean; pageNumber: number; totalPages: number }) {
  const size = PAGE_SIZES_MM[worksheet.pageSettings.size];
  const margin = MARGINS_MM[worksheet.pageSettings.margin];
  return <div className="preview-page-wrap">
    <div data-preview-page="true" className={`paper-page font-${worksheet.pageSettings.fontFamily}`} style={{ aspectRatio: `${size.width} / ${size.height}`, padding: `${margin / size.width * 100}%` }}>
      {showHeader && <WorksheetHeader worksheet={worksheet} />}
      <div className="paper-problems">
        {atoms.map((atom) => <PreviewProblemFragment key={atom.key} atom={atom} mode={mode} subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls} scrollAnchor={atom.startsProblem} />)}
      </div>
    </div>
    <span className="page-counter">{pageNumber} / {totalPages}</span>
  </div>;
}

function MeasurementPage({ worksheet, section, assetUrls }: { worksheet: Worksheet; section: PreviewSection; assetUrls: Map<string, string> }) {
  const size = PAGE_SIZES_MM[worksheet.pageSettings.size];
  const margin = MARGINS_MM[worksheet.pageSettings.margin];
  return <div data-pagination-section={section.mode}>
    <div className={`paper-page font-${worksheet.pageSettings.fontFamily}`} style={{ aspectRatio: `${size.width} / ${size.height}`, padding: `${margin / size.width * 100}%` }}>
      <WorksheetHeader worksheet={worksheet} />
      <div className="paper-problems">
        {section.atoms.map((atom) => <div data-pagination-atom={atom.key} key={atom.key}><PreviewProblemFragment atom={atom} mode={section.mode} subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls} /></div>)}
      </div>
    </div>
  </div>;
}

function WorksheetHeader({ worksheet }: { worksheet: Worksheet }) {
  return <header className="paper-header"><h2>{worksheet.title}</h2><div className="paper-fields">{worksheet.header.gradeField && <span className="grade-field"><i />年</span>}{worksheet.header.classField && <span className="class-field"><i />組</span>}{worksheet.header.numberField && <span className="number-field"><i />番</span>}{worksheet.header.nameField && <span className="name-field">名前<i /></span>}</div></header>;
}

function PreviewProblemFragment({ atom, mode, subQuestionNumberFormat, assetUrls, scrollAnchor = false }: { atom: RenderAtom; mode: SectionMode; subQuestionNumberFormat: SubQuestionNumberFormat; assetUrls: Map<string, string>; scrollAnchor?: boolean }) {
  return <section className={atom.startsProblem ? "paper-problem" : "paper-problem paper-problem-continuation"} data-preview-problem-id={scrollAnchor ? atom.problem.id : undefined} data-preview-section={scrollAnchor ? mode : undefined}>
    <span className="paper-problem-number">{atom.startsProblem ? atom.number : null}</span>
    <div className="paper-problem-body">
      {atom.content && <PreviewContent content={atom.content} showAnswers={mode === "withAnswers"} subQuestionNumberFormat={subQuestionNumberFormat} assetUrls={assetUrls} />}
      {atom.showSolution && <div className="paper-solution">{atom.showSolutionHeading && <strong>解説</strong>}<RichDocument document={atom.problem.solution!} assetUrls={assetUrls} showAnswers /></div>}
    </div>
  </section>;
}

function createRenderAtoms(worksheet: Worksheet, mode: SectionMode, numbers: Map<string, string | null>): RenderAtom[] {
  const atoms: RenderAtom[] = [];

  for (const problem of worksheet.problems) {
    const problemAtoms: RenderAtom[] = [];
    let breakBeforeNext = problem.pageBreakBefore;

    for (const content of problem.contents) {
      if (content.type === "pageBreak") {
        const previous = problemAtoms.at(-1);
        if (previous) previous.breakAfter = true;
        breakBeforeNext = true;
        continue;
      }
      if (mode === "questions" && content.type === "goal") continue;
      if (mode === "withAnswers" && content.type === "answerArea" && !hasVisibleAnswerAreaContent(content.answerArea)) continue;

      problemAtoms.push({
        key: `${mode}:${problem.id}:content:${content.id}`,
        problem,
        number: getProblemHeading(worksheet, problem, numbers),
        content,
        showSolution: false,
        showSolutionHeading: false,
        startsProblem: problemAtoms.length === 0,
        breakBefore: breakBeforeNext,
        breakAfter: false,
      });
      breakBeforeNext = false;
    }

    if (mode === "withAnswers" && hasVisibleDocument(problem.solution)) {
      problemAtoms.push({
        key: `${mode}:${problem.id}:solution`,
        problem,
        number: getProblemHeading(worksheet, problem, numbers),
        content: null,
        showSolution: true,
        showSolutionHeading: true,
        startsProblem: problemAtoms.length === 0,
        breakBefore: breakBeforeNext,
        breakAfter: false,
      });
      breakBeforeNext = false;
    }

    if (problemAtoms.length === 0) {
      problemAtoms.push({
        key: `${mode}:${problem.id}:empty`,
        problem,
        number: getProblemHeading(worksheet, problem, numbers),
        content: null,
        showSolution: false,
        showSolutionHeading: false,
        startsProblem: true,
        breakBefore: breakBeforeNext,
        breakAfter: false,
      });
    }

    problemAtoms.at(-1)!.breakAfter ||= problem.pageBreakAfter || breakBeforeNext;
    atoms.push(...problemAtoms);
  }

  return atoms;
}

function getProblemHeading(
  worksheet: Worksheet,
  problem: ProblemBlock,
  numbers: Map<string, string | null>,
): string | null {
  const number = numbers.get(problem.id) ?? null;
  return number === null
    ? null
    : formatProblemHeading(problem.kind, number, worksheet.pageSettings.problemNumberFormat);
}

function fallbackPages(sections: readonly PreviewSection[]): PlannedPage[] {
  return sections.map((section) => ({
    mode: section.mode,
    sectionPageIndex: 0,
    atomKeys: section.atoms.map((atom) => atom.key),
  }));
}

function measurePages(measurementRoot: HTMLElement, sections: readonly PreviewSection[]): PlannedPage[] {
  return sections.flatMap((section) => {
    const sectionElement = measurementRoot.querySelector<HTMLElement>(`[data-pagination-section="${section.mode}"]`);
    const paper = sectionElement?.querySelector<HTMLElement>(".paper-page");
    const header = sectionElement?.querySelector<HTMLElement>(".paper-header");
    const problemList = sectionElement?.querySelector<HTMLElement>(".paper-problems");
    if (!sectionElement || !paper || !header || !problemList) {
      return [{ mode: section.mode, sectionPageIndex: 0, atomKeys: section.atoms.map((atom) => atom.key) }];
    }

    const paperStyle = getComputedStyle(paper);
    const contentHeight = paper.getBoundingClientRect().height
      - toPixels(paperStyle.paddingTop)
      - toPixels(paperStyle.paddingBottom);
    const headerHeight = outerHeight(header);
    const problemGap = toPixels(getComputedStyle(problemList).rowGap);
    const measuredElements = new Map(
      Array.from(sectionElement.querySelectorAll<HTMLElement>("[data-pagination-atom]"))
        .map((element) => [element.dataset.paginationAtom!, element]),
    );
    const measuredItems = section.atoms.map((atom) => ({
      key: atom.key,
      height: outerHeight(measuredElements.get(atom.key)),
      startsProblem: atom.startsProblem,
      breakBefore: atom.breakBefore,
      breakAfter: atom.breakAfter,
    }));
    const pageKeys = paginateMeasuredItems(
      measuredItems,
      Math.max(1, contentHeight - headerHeight - 1),
      Math.max(1, contentHeight - 1),
      problemGap,
    );

    return pageKeys.map((atomKeys, sectionPageIndex) => ({ mode: section.mode, sectionPageIndex, atomKeys }));
  });
}

function outerHeight(element: HTMLElement | undefined): number {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return element.getBoundingClientRect().height + toPixels(style.marginTop) + toPixels(style.marginBottom);
}

function toPixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

function PreviewContent({ content, showAnswers, subQuestionNumberFormat, assetUrls }: { content: ContentBlock; showAnswers: boolean; subQuestionNumberFormat: SubQuestionNumberFormat; assetUrls: Map<string, string> }) {
  switch (content.type) {
    case "richText": return <RichDocument document={mergeColoredDocuments(content.document, content.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers} />;
    case "box": return <div className={`paper-box box-${content.preset}`}>{content.title && <strong>{content.title}</strong>}<RichDocument document={mergeColoredDocuments(content.document, content.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers} /></div>;
    case "goal": return showAnswers ? <div className="paper-goal answer-color"><strong>めあて</strong><RichDocument document={colorDocumentAsAnswer(content.document)} assetUrls={assetUrls} showAnswers /></div> : null;
    case "answerArea": return <StudentAnswerArea answerArea={content.answerArea} showAnswers={showAnswers} assetUrls={assetUrls} />;
    case "spacer": return <div style={{ height: `${content.rows * 1.25}em` }} />;
    case "pageBreak": return <div className="preview-page-break" />;
    case "image": { const url = assetUrls.get(content.assetId); return url ? <img className={`paper-image ${content.placement}`} style={{ width: `${content.widthPercent}%` }} src={url} alt={content.alt} /> : <div className="missing-asset">画像を読み込めません</div>; }
    case "table": return <PreviewTable rows={content.rows} headerRow={content.headerRow} columnWidthsPercent={content.columnWidthsPercent} assetUrls={assetUrls} showAnswers={showAnswers} />;
    case "subQuestionGroup": {
      const numbers = getSubQuestionNumbers(content, subQuestionNumberFormat);
      return <div className="paper-subquestions">{content.items.map((item) => <div className={item.width === "full" ? "paper-subquestion full" : "paper-subquestion"} key={item.id}>
        <div className="paper-subquestion-main"><b>{numbers.get(item.id)}</b><div><RichDocument document={mergeColoredDocuments(item.content, item.answerContent)} assetUrls={assetUrls} showAnswers={showAnswers} /></div></div>
        {item.answerArea && (!showAnswers || hasVisibleAnswerAreaContent(item.answerArea)) && <StudentAnswerArea answerArea={item.answerArea} showAnswers={showAnswers} assetUrls={assetUrls} />}
        {showAnswers && hasVisibleDocument(item.solution) && <div className="sub-solution"><b>解説</b><RichDocument document={item.solution!} assetUrls={assetUrls} showAnswers /></div>}
      </div>)}</div>;
    }
  }
}

function RichDocument({ document, assetUrls, showAnswers }: { document: { content: readonly unknown[] }; assetUrls: Map<string, string>; showAnswers: boolean }) {
  return <div className="paper-rich-text">{document.content.map((node, index) => <RichNode key={index} node={node} assetUrls={assetUrls} showAnswers={showAnswers} />)}</div>;
}

function RichNode({ node, assetUrls, showAnswers }: { node: unknown; assetUrls: Map<string, string>; showAnswers: boolean }): React.ReactNode {
  if (!node || typeof node !== "object" || !isNodeVisibleInMode(node, showAnswers)) return null;
  const value = node as { type?: string; text?: string; marks?: Array<{ type?: string; attrs?: { size?: string } }>; attrs?: Record<string, unknown>; content?: readonly unknown[] };
  const children = value.content?.map((child, index) => <RichNode key={index} node={child} assetUrls={assetUrls} showAnswers={showAnswers} />) ?? [];
  const answerClass = isAnswerOnlyNode(node) ? "answer-color" : undefined;

  switch (value.type) {
    case "text": {
      let rendered: React.ReactNode = value.text ?? "";
      for (const mark of value.marks ?? []) {
        if (mark.type === "bold") rendered = <strong>{rendered}</strong>;
        else if (mark.type === "underline") rendered = <u>{rendered}</u>;
        else if (mark.type === "italic") rendered = <em>{rendered}</em>;
        else if (mark.type === "textSize") rendered = <span className={`text-size-${String(mark.attrs?.size ?? "normal")}`}>{rendered}</span>;
        else if (mark.type === "answerColor") rendered = <span className="answer-color">{rendered}</span>;
      }
      return rendered;
    }
    case "hardBreak": return <br />;
    case "paragraph": return <p className={answerClass} style={{ textAlign: toTextAlign(value.attrs?.textAlign) }}>{children.length ? children : <>&nbsp;</>}</p>;
    case "listItem": return <li className={answerClass}>{children}</li>;
    case "bulletList": return <ul className={answerClass}>{children}</ul>;
    case "orderedList": return <ol className={answerClass} start={Number(value.attrs?.start ?? 1)}>{children}</ol>;
    case "inlineMath": return <span className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><MathFormula latex={readStringAttribute(value.attrs?.latex)} textSize={toMathTextSize(value.attrs?.textSize)} /></span>;
    case "blockMath": return <div className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><MathFormula latex={readStringAttribute(value.attrs?.latex)} textSize={toMathTextSize(value.attrs?.textSize)} block /></div>;
    case "imageRef": {
      const url = assetUrls.get(readStringAttribute(value.attrs?.assetId));
      return url
        ? <img className={`paper-image ${toImagePlacement(value.attrs?.placement)}${nodeUsesAnswerColor(node) ? " answer-color" : ""}`} style={{ width: `${Number(value.attrs?.widthPercent ?? 50)}%` }} src={url} alt={readStringAttribute(value.attrs?.alt)} />
        : <div className="missing-asset">画像を読み込めません</div>;
    }
    case "richTable": return <div className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><PreviewTable rows={Array.isArray(value.attrs?.rows) ? value.attrs.rows as TableRow[] : []} headerRow={Boolean(value.attrs?.headerRow)} columnWidthsPercent={Array.isArray(value.attrs?.columnWidthsPercent) ? value.attrs.columnWidthsPercent as number[] : []} assetUrls={assetUrls} showAnswers={showAnswers} /></div>;
    default: return null;
  }
}

function isNodeVisibleInMode(node: unknown, showAnswers: boolean): boolean {
  if (!node || typeof node !== "object") return false;
  if (nodeUsesAnswerColor(node)) return showAnswers;
  const value = node as { type?: string; text?: string; content?: readonly unknown[] };
  if (value.type === "text") return Boolean(value.text);
  if (["hardBreak", "inlineMath", "blockMath", "imageRef", "richTable", "spacer"].includes(value.type ?? "")) return true;
  if (!Array.isArray(value.content) || value.content.length === 0) return value.type === "paragraph";
  return value.content.some((child) => isNodeVisibleInMode(child, showAnswers));
}

function isAnswerOnlyNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (nodeUsesAnswerColor(node)) return true;
  const content = (node as { content?: readonly unknown[] }).content;
  if (!Array.isArray(content)) return false;
  const visibleChildren = content.filter((child) => isNodeVisibleInMode(child, true));
  return visibleChildren.length > 0 && visibleChildren.every(isAnswerOnlyNode);
}

function PreviewTable({ rows, headerRow, columnWidthsPercent, assetUrls, showAnswers }: { rows: TableRow[]; headerRow: boolean; columnWidthsPercent: number[]; assetUrls: Map<string, string>; showAnswers: boolean }) {
  return <table className="paper-table"><colgroup>{columnWidthsPercent.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><tbody>{rows.map((row, rowIndex) => <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((cell) => {
    const Cell = headerRow && rowIndex === 0 ? "th" : "td";
    return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan}><RichDocument document={cell.document} assetUrls={assetUrls} showAnswers={showAnswers} /></Cell>;
  })}</tr>)}</tbody></table>;
}

function toMathTextSize(value: unknown): "small" | "normal" | "large" | "xLarge" {
  return value === "small" || value === "large" || value === "xLarge" ? value : "normal";
}

function readStringAttribute(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toTextAlign(value: unknown): React.CSSProperties["textAlign"] {
  return value === "center" || value === "right" ? value : "left";
}

function toImagePlacement(value: unknown): "block" | "floatLeft" | "floatRight" {
  return value === "floatLeft" || value === "floatRight" ? value : "block";
}

function StudentAnswerArea({ answerArea, showAnswers, assetUrls }: { answerArea: AnswerAreaValue; showAnswers: boolean; assetUrls: Map<string, string> }) {
  return <div className="paper-student-answer-area">
    <div className={`paper-answer-response ${answerArea.style === "box" ? "paper-answer-box" : "paper-answer-lines"}`} style={{ minHeight: `${answerArea.rows * 1.7}em` }}>
      <RichDocument document={mergeColoredDocuments(answerArea.document, answerArea.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers} />
    </div>
  </div>;
}

function hasVisibleAnswerAreaContent(answerArea: AnswerAreaValue): boolean {
  return hasVisibleDocument(answerArea.document) || hasVisibleDocument(answerArea.answerDocument);
}
