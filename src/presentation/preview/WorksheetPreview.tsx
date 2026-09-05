import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { MARGINS_MM, PAGE_SIZES_MM } from "../../domain/worksheet/page-tokens";
import { colorDocumentAsAnswer, hasVisibleDocument, mergeColoredDocuments, nodeUsesAnswerColor } from "../../domain/worksheet/rich-text";
import type { AnswerArea as AnswerAreaValue, ContentBlock, ProblemBlock, SolutionRichTextDocument, SubQuestionNumberFormat, TableRow, Worksheet } from "../../domain/worksheet/worksheet";
import { formatProblemHeading, getProblemNumbers, getSubQuestionNumbers } from "../../domain/worksheet/worksheet.numbering";
import type { PreviewMode } from "../../application/pdf/generate-pdf";
import { MathFormula } from "../components/MathFormula";
import { planMeasuredPagination } from "./pagination";
type Props = {
    worksheet: Worksheet;
    mode: PreviewMode;
    zoom: number;
    assetUrls: ReadonlyMap<string, string>;
    onPageCountChange?: (pageCount: number) => void;
    onPaginationErrorChange?: (error: string | null) => void;
    onPaginationReadyChange?: (ready: boolean) => void;
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
type PreviewSection = {
    mode: SectionMode;
    atoms: RenderAtom[];
};
type PlannedPage = {
    mode: SectionMode;
    sectionPageIndex: number;
    atomKeys: string[];
};
type MeasuredPagePlan = {
    pages: PlannedPage[];
    oversizedAtomKeys: string[];
};
export const WorksheetPreview = memo((/**
 * WorksheetPreviewコンポーネントを表示する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function WorksheetPreview(parameter1: Props) {
    let { worksheet, mode, zoom, assetUrls, onPageCountChange, onPaginationErrorChange, onPaginationReadyChange } = parameter1;
    const numbers = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue2() {
        return getProblemNumbers(worksheet);
    }), [worksheet]);
    const sections = useMemo<PreviewSection[]>((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue3() {
        const sectionModes = mode === "questionsAndAnswers"
            ? (["questions", "withAnswers"] as const)
            : ([mode] as const);
        return sectionModes.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param sectionMode sectionModeとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem4(sectionMode) {
            return ({
                mode: sectionMode,
                atoms: createRenderAtoms(worksheet, sectionMode, numbers),
            });
        }));
    }), [mode, numbers, worksheet]);
    const sectionStructureKey = useMemo((/**
     * 依存値から再利用する計算結果を作成する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function calculateMemoizedValue5() {
        return JSON.stringify(sections.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param section sectionとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem6(section) {
            return [
                section.mode,
                ...section.atoms.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param atom atomとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem7(atom) {
                    return atom.key;
                })),
            ];
        })));
    }), [sections]);
    const measurementRef = useRef<HTMLDivElement>(null);
    const [pagination, setPagination] = useState<{
        ready: boolean;
        measuredWorksheet: Worksheet | null;
        sectionStructureKey: string;
        pages: PlannedPage[];
        oversizedAtomKeys: string[];
    }>({ ready: false, measuredWorksheet: null, sectionStructureKey, pages: fallbackPages(sections), oversizedAtomKeys: [] });
    const needsMeasurement = pagination.measuredWorksheet !== worksheet
        || pagination.sectionStructureKey !== sectionStructureKey;
    useLayoutEffect((/**
     * 描画前にレイアウト依存の状態を同期する。
     *
     * @returns 呼び出し元で使用する処理結果
     */
    function synchronizeLayoutEffect8() {
        let cancelled = false;
        let animationFrame = 0;
        let assetsReady = false;
        let resizeObserver: ResizeObserver | null = null;
        const measurementRoot = measurementRef.current;
        if (!measurementRoot)
            return;
        setPagination((/**
         * setPaginationへ渡す処理を実行する。
         *
         * @param current 更新前または現在の状態
         * @returns 呼び出し元で使用する処理結果
         */
        function setPaginationCallback9(current) {
            return ({ ...current, ready: false });
        }));
        const measure = (/**
         * measureで必要な値を取得する。
         */
        function measureImplementation10() {
            if (cancelled || !measurementRoot.isConnected)
                return;
            const plan = measurePages(measurementRoot, sections);
            // 状態更新後に計測用ツリーが削除されるため、先に監視を解除する。
            // 切り離された寸法0の要素による再計測で、正常な改ページ結果が
            // 上書きされることを防ぐ。
            resizeObserver?.disconnect();
            setPagination({
                ready: true,
                measuredWorksheet: worksheet,
                sectionStructureKey,
                pages: plan.pages,
                oversizedAtomKeys: plan.oversizedAtomKeys,
            });
        });
        const scheduleMeasure = (/**
         * scheduleMeasureに必要な処理を実行する。
         */
        function scheduleMeasureImplementation11() {
            if (!assetsReady)
                return;
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(measure);
        });
        const prepare = (/**
         * prepareに必要な処理を実行する。
         *
         * @returns 非同期処理の結果
         */
        async function prepareImplementation12() {
            await document.fonts?.ready;
            await Promise.all(Array.from(measurementRoot.querySelectorAll("img")).map(waitForImage));
            assetsReady = true;
            scheduleMeasure();
        });
        void prepare();
        resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
        measurementRoot.querySelectorAll(".paper-header, [data-pagination-atom]").forEach((/**
         * 各要素へ必要な処理を適用する。
         *
         * @param element 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function processItem13(element) {
            return resizeObserver?.observe(element);
        }));
        return (/**
         * 呼び出し元から要求された処理を実行する。
         */
        function commentRuleCallback14() {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            resizeObserver?.disconnect();
        });
    }), [sectionStructureKey, sections, worksheet]);
    // 内容の再計測中は直前の改ページ結果を維持する。入力ごとに単一ページへ戻すと
    // プレビュー全体が再マウントされ、大規模プリントでは一つの内容変更だけでも
    // メインスレッドを長時間占有するためである。
    const paginationReady = pagination.ready
        && !needsMeasurement
        && pagination.sectionStructureKey === sectionStructureKey;
    const displayedPages = pagination.sectionStructureKey === sectionStructureKey
        ? pagination.pages
        : fallbackPages(sections);
    const paginationError = paginationReady && pagination.oversizedAtomKeys.length > 0
        ? OVERSIZED_PAGINATION_MESSAGE
        : null;
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect15() {
        onPaginationReadyChange?.(paginationReady);
    }), [onPaginationReadyChange, paginationReady]);
    useEffect((/**
     * 外部状態と画面状態を同期する副作用を実行する。
     */
    function synchronizeEffect16() {
        if (!paginationReady)
            return;
        onPageCountChange?.(displayedPages.length);
        onPaginationErrorChange?.(paginationError);
    }), [displayedPages.length, onPageCountChange, onPaginationErrorChange, paginationError, paginationReady]);
    const atomLookup = new Map(sections.flatMap((/**
     * 各要素を変換しながら一つの配列へ展開する。
     *
     * @param section sectionとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function expandItem17(section) {
        return section.atoms;
    })).map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param atom atomとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem18(atom) {
        return [atom.key, atom];
    })));
    return <div className="preview-pages" data-pagination-ready={paginationReady ? "true" : "false"} data-pagination-error={paginationError ? OVERSIZED_PAGINATION_ERROR : undefined} style={{ "--preview-zoom": zoom } as React.CSSProperties}>
    {paginationError && <div className="notice danger preview-pagination-error" role="alert">{paginationError}</div>}
    {displayedPages.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param page pageとして使用する値
         * @param pageIndex pageIndexとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem19(page, pageIndex) {
            return <Fragment key={`${page.mode}:${page.sectionPageIndex}`}>
      <PreviewPage worksheet={worksheet} mode={page.mode} atoms={page.atomKeys.flatMap((/**
             * 各要素を変換しながら一つの配列へ展開する。
             *
             * @param key keyとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function expandItem20(key) {
                return atomLookup.get(key) ?? [];
            }))} assetUrls={assetUrls} showHeader={page.sectionPageIndex === 0} pageNumber={pageIndex + 1} totalPages={displayedPages.length}/>
    </Fragment>;
        }))}
    {needsMeasurement && <div className="preview-measurement" ref={measurementRef} aria-hidden="true">
      {sections.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param section sectionとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem21(section) {
            return <MeasurementPage key={section.mode} worksheet={worksheet} section={section} assetUrls={assetUrls}/>;
        }))}
    </div>}
  </div>;
}));
/**
 * PreviewPageコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function PreviewPage(props: {
    worksheet: Worksheet;
    mode: SectionMode;
    atoms: RenderAtom[];
    assetUrls: ReadonlyMap<string, string>;
    showHeader: boolean;
    pageNumber: number;
    totalPages: number;
}) {
    let { worksheet, mode, atoms, assetUrls, showHeader, pageNumber, totalPages } = props;
    const size = PAGE_SIZES_MM[worksheet.pageSettings.size];
    const margin = MARGINS_MM[worksheet.pageSettings.margin];
    return <div className="preview-page-wrap">
    <div data-preview-page="true" className={`paper-page font-${worksheet.pageSettings.fontFamily}`} style={{ aspectRatio: `${size.width} / ${size.height}`, padding: `${margin / size.width * 100}%` }}>
      {showHeader && <WorksheetHeader worksheet={worksheet}/>}
      <div className="paper-problems">
        {atoms.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param atom atomとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem22(atom) {
        return <PreviewProblemFragment key={atom.key} atom={atom} mode={mode} subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls} scrollAnchor={atom.startsProblem}/>;
    }))}
      </div>
    </div>
    <span className="page-counter">{pageNumber} / {totalPages}</span>
  </div>;
}
/**
 * MeasurementPageコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function MeasurementPage(props: {
    worksheet: Worksheet;
    section: PreviewSection;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { worksheet, section, assetUrls } = props;
    const size = PAGE_SIZES_MM[worksheet.pageSettings.size];
    const margin = MARGINS_MM[worksheet.pageSettings.margin];
    return <div data-pagination-section={section.mode}>
    <div className={`paper-page font-${worksheet.pageSettings.fontFamily}`} style={{ aspectRatio: `${size.width} / ${size.height}`, padding: `${margin / size.width * 100}%` }}>
      <WorksheetHeader worksheet={worksheet}/>
      <div className="paper-problems">
        {section.atoms.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param atom atomとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem23(atom) {
        return <div data-pagination-atom={atom.key} key={atom.key}><PreviewProblemFragment atom={atom} mode={section.mode} subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls}/></div>;
    }))}
      </div>
    </div>
  </div>;
}
/**
 * WorksheetHeaderコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function WorksheetHeader(props: {
    worksheet: Worksheet;
}) {
    let { worksheet } = props;
    return <header className="paper-header"><h2>{worksheet.title}</h2><div className="paper-fields">{worksheet.header.gradeField && <span className="grade-field"><i />年</span>}{worksheet.header.classField && <span className="class-field"><i />組</span>}{worksheet.header.numberField && <span className="number-field"><i />番</span>}{worksheet.header.nameField && <span className="name-field">名前<i /></span>}</div></header>;
}
/**
 * PreviewProblemFragmentコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function PreviewProblemFragment(props: {
    atom: RenderAtom;
    mode: SectionMode;
    subQuestionNumberFormat: SubQuestionNumberFormat;
    assetUrls: ReadonlyMap<string, string>;
    scrollAnchor?: boolean;
}) {
    let { atom, mode, subQuestionNumberFormat, assetUrls, scrollAnchor = false } = props;
    return <section className={atom.startsProblem ? "paper-problem" : "paper-problem paper-problem-continuation"} data-preview-problem-id={scrollAnchor ? atom.problem.id : undefined} data-preview-section={scrollAnchor ? mode : undefined}>
    <span className="paper-problem-number">{atom.startsProblem ? atom.number : null}</span>
    <div className="paper-problem-body">
      {atom.content && <WorksheetContentPreview content={atom.content} showAnswers={mode === "withAnswers"} subQuestionNumberFormat={subQuestionNumberFormat} assetUrls={assetUrls}/>}
      {atom.showSolution && <div className="paper-solution">{atom.showSolutionHeading && <strong>解説</strong>}<RichDocument document={atom.problem.solution!} assetUrls={assetUrls} showAnswers/></div>}
    </div>
  </section>;
}
/**
 * createRenderAtomsで必要な値を作成する。
 *
 * @param worksheet worksheetとして使用する値
 * @param mode modeとして使用する値
 * @param numbers numbersとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function createRenderAtoms(worksheet: Worksheet, mode: SectionMode, numbers: Map<string, string | null>): RenderAtom[] {
    const atoms: RenderAtom[] = [];
    for (const problem of worksheet.problems) {
        const problemAtoms: RenderAtom[] = [];
        let breakBeforeNext = problem.pageBreakBefore;
        for (const content of problem.contents) {
            if (content.type === "pageBreak") {
                const previous = problemAtoms.at(-1);
                if (previous)
                    previous.breakAfter = true;
                breakBeforeNext = true;
                continue;
            }
            if (mode === "questions" && content.type === "goal")
                continue;
            if (mode === "withAnswers" && content.type === "answerArea" && !hasVisibleAnswerAreaContent(content.answerArea))
                continue;
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
/**
 * getProblemHeadingで必要な値を取得する。
 *
 * @param worksheet worksheetとして使用する値
 * @param problem problemとして使用する値
 * @param numbers numbersとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function getProblemHeading(worksheet: Worksheet, problem: ProblemBlock, numbers: Map<string, string | null>): string | null {
    const number = numbers.get(problem.id) ?? null;
    return number === null
        ? null
        : formatProblemHeading(problem.kind, number, worksheet.pageSettings.problemNumberFormat);
}
/**
 * fallbackPagesに必要な処理を実行する。
 *
 * @param sections sectionsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function fallbackPages(sections: readonly PreviewSection[]): PlannedPage[] {
    return sections.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param section sectionとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem24(section) {
        return ({
            mode: section.mode,
            sectionPageIndex: 0,
            atomKeys: section.atoms.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param atom atomとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem25(atom) {
                return atom.key;
            })),
        });
    }));
}
/**
 * measurePagesで必要な値を取得する。
 *
 * @param measurementRoot measurementRootとして使用する値
 * @param sections sectionsとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function measurePages(measurementRoot: HTMLElement, sections: readonly PreviewSection[]): MeasuredPagePlan {
    const sectionPlans = sections.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param section sectionとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem26(section): MeasuredPagePlan {
        const sectionElement = measurementRoot.querySelector<HTMLElement>(`[data-pagination-section="${section.mode}"]`);
        const paper = sectionElement?.querySelector<HTMLElement>(".paper-page");
        const header = sectionElement?.querySelector<HTMLElement>(".paper-header");
        const problemList = sectionElement?.querySelector<HTMLElement>(".paper-problems");
        if (!sectionElement || !paper || !header || !problemList) {
            return {
                pages: [{ mode: section.mode, sectionPageIndex: 0, atomKeys: section.atoms.map((/**
                         * 各要素を画面表示または別形式へ変換する。
                         *
                         * @param atom atomとして使用する値
                         * @returns 呼び出し元で使用する処理結果
                         */
                        function mapItem27(atom) {
                            return atom.key;
                        })) }],
                oversizedAtomKeys: [],
            };
        }
        const paperStyle = getComputedStyle(paper);
        const contentHeight = paper.getBoundingClientRect().height
            - toPixels(paperStyle.paddingTop)
            - toPixels(paperStyle.paddingBottom);
        const headerHeight = outerHeight(header);
        const problemGap = toPixels(getComputedStyle(problemList).rowGap);
        const measuredElements = new Map(Array.from(sectionElement.querySelectorAll<HTMLElement>("[data-pagination-atom]"))
            .map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param element 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem28(element) {
            return [element.dataset.paginationAtom!, element];
        })));
        const measuredItems = section.atoms.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param atom atomとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem29(atom) {
            return ({
                key: atom.key,
                height: outerHeight(measuredElements.get(atom.key)),
                startsProblem: atom.startsProblem,
                breakBefore: atom.breakBefore,
                breakAfter: atom.breakAfter,
            });
        }));
        const plan = planMeasuredPagination(measuredItems, Math.max(1, contentHeight - headerHeight - 1), Math.max(1, contentHeight - 1), problemGap);
        return {
            pages: plan.pages.map((/**
             * 各要素を画面表示または別形式へ変換する。
             *
             * @param atomKeys atomKeysとして使用する値
             * @param sectionPageIndex sectionPageIndexとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function mapItem30(atomKeys, sectionPageIndex) {
                return ({ mode: section.mode, sectionPageIndex, atomKeys });
            })),
            oversizedAtomKeys: plan.oversizedItemKeys,
        };
    }));
    return {
        pages: sectionPlans.flatMap((/**
         * 各要素を変換しながら一つの配列へ展開する。
         *
         * @param plan planとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function expandItem31(plan) {
            return plan.pages;
        })),
        oversizedAtomKeys: sectionPlans.flatMap((/**
         * 各要素を変換しながら一つの配列へ展開する。
         *
         * @param plan planとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function expandItem32(plan) {
            return plan.oversizedAtomKeys;
        })),
    };
}
/**
 * outerHeightに必要な処理を実行する。
 *
 * @param element 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function outerHeight(element: HTMLElement | undefined): number {
    if (!element)
        return 0;
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height + toPixels(style.marginTop) + toPixels(style.marginBottom);
}
/**
 * toPixelsの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function toPixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
/**
 * waitForImageに必要な処理を実行する。
 *
 * @param image imageとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function waitForImage(image: HTMLImageElement): Promise<void> {
    if (image.complete)
        return Promise.resolve();
    return new Promise((/**
     * 呼び出し元から要求された処理を実行する。
     *
     * @param resolve resolveとして使用する値
     */
    function commentRuleCallback33(resolve) {
        image.addEventListener("load", (/**
         * DOMから通知されたイベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleDomEvent34() {
            return resolve();
        }), { once: true });
        image.addEventListener("error", (/**
         * DOMから通知されたイベントを処理する。
         *
         * @returns 呼び出し元で使用する処理結果
         */
        function handleDomEvent35() {
            return resolve();
        }), { once: true });
    }));
}
export const WorksheetContentPreview = memo((/**
 * WorksheetContentPreviewコンポーネントを表示する。
 *
 * @param parameter1 parameter1として使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function WorksheetContentPreview(parameter1: {
    content: ContentBlock;
    showAnswers: boolean;
    subQuestionNumberFormat: SubQuestionNumberFormat;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { content, showAnswers, subQuestionNumberFormat, assetUrls } = parameter1;
    switch (content.type) {
        case "richText": return <RichDocument document={mergeColoredDocuments(content.document, content.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers}/>;
        case "box": return <div className={`paper-box box-${content.preset}`}>{content.title && <strong>{content.title}</strong>}<RichDocument document={mergeColoredDocuments(content.document, content.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers}/></div>;
        case "goal": return showAnswers ? <div className="paper-goal answer-color"><strong>めあて</strong><RichDocument document={colorDocumentAsAnswer(content.document)} assetUrls={assetUrls} showAnswers/></div> : null;
        case "answerArea": return <StudentAnswerArea answerArea={content.answerArea} showAnswers={showAnswers} assetUrls={assetUrls}/>;
        case "spacer": return <div style={{ height: `${content.rows * 1.25}em` }}/>;
        case "pageBreak": return <div className="preview-page-break"/>;
        case "image": {
            const url = assetUrls.get(content.assetId);
            return url ? <img className={`paper-image ${content.placement}`} style={{ width: `${content.widthPercent}%` }} src={url} alt={content.alt}/> : <div className="missing-asset">画像を読み込めません</div>;
        }
        case "table": return <PreviewTable rows={content.rows} headerRow={content.headerRow} columnWidthsPercent={content.columnWidthsPercent} assetUrls={assetUrls} showAnswers={showAnswers}/>;
        case "subQuestionGroup": {
            const numbers = getSubQuestionNumbers(content, subQuestionNumberFormat);
            return <div className="paper-subquestions">{content.items.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param item 処理対象の値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem37(item) {
                    return <div className={item.width === "full" ? "paper-subquestion full" : "paper-subquestion"} key={item.id}>
        <div className="paper-subquestion-main"><b>{numbers.get(item.id)}</b><div><RichDocument document={mergeColoredDocuments(item.content, item.answerContent)} assetUrls={assetUrls} showAnswers={showAnswers}/></div></div>
        {item.answerArea && (!showAnswers || hasVisibleAnswerAreaContent(item.answerArea)) && <StudentAnswerArea answerArea={item.answerArea} showAnswers={showAnswers} assetUrls={assetUrls}/>}
        {showAnswers && hasVisibleDocument(item.solution) && <div className="sub-solution"><b>解説</b><RichDocument document={item.solution!} assetUrls={assetUrls} showAnswers/></div>}
      </div>;
                }))}</div>;
        }
    }
}));
/**
 * WorksheetSolutionPreviewコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
export function WorksheetSolutionPreview(props: {
    document: SolutionRichTextDocument;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { document, assetUrls } = props;
    return <RichDocument document={document} assetUrls={assetUrls} showAnswers/>;
}
/**
 * RichDocumentコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function RichDocument(props: {
    document: {
        content: readonly unknown[];
    };
    assetUrls: ReadonlyMap<string, string>;
    showAnswers: boolean;
}) {
    let { document, assetUrls, showAnswers } = props;
    return <div className="paper-rich-text">{document.content.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param node 処理対象の値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem38(node, index) {
        return <RichNode key={index} node={node} assetUrls={assetUrls} showAnswers={showAnswers}/>;
    }))}</div>;
}
/**
 * RichNodeコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function RichNode(props: {
    node: unknown;
    assetUrls: ReadonlyMap<string, string>;
    showAnswers: boolean;
}): React.ReactNode {
    let { node, assetUrls, showAnswers } = props;
    if (!node || typeof node !== "object")
        return null;
    const preserveUnderlinedAnswerWidth = !showAnswers && isUnderlinedAnswerText(node);
    if (!preserveUnderlinedAnswerWidth && !isNodeVisibleInMode(node, showAnswers))
        return null;
    const value = node as {
        type?: string;
        text?: string;
        marks?: Array<{
            type?: string;
            attrs?: {
                size?: string;
            };
        }>;
        attrs?: Record<string, unknown>;
        content?: readonly unknown[];
    };
    const children = value.content?.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param child childとして使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem39(child, index) {
        return <RichNode key={index} node={child} assetUrls={assetUrls} showAnswers={showAnswers}/>;
    })) ?? [];
    const answerClass = isAnswerOnlyNode(node) ? "answer-color" : undefined;
    switch (value.type) {
        case "text": {
            let rendered: React.ReactNode = value.text ?? "";
            for (const mark of value.marks ?? []) {
                if (mark.type === "bold")
                    rendered = <strong>{rendered}</strong>;
                else if (mark.type === "underline")
                    rendered = <u>{rendered}</u>;
                else if (mark.type === "italic")
                    rendered = <em>{rendered}</em>;
                else if (mark.type === "textSize")
                    rendered = <span className={`text-size-${String(mark.attrs?.size ?? "normal")}`}>{rendered}</span>;
                else if (mark.type === "answerColor" && showAnswers)
                    rendered = <span className="answer-color">{rendered}</span>;
            }
            return preserveUnderlinedAnswerWidth
                ? <span className="paper-answer-placeholder" aria-hidden="true">{rendered}</span>
                : rendered;
        }
        case "hardBreak": return <br />;
        case "paragraph": return <p className={answerClass} style={{ textAlign: toTextAlign(value.attrs?.textAlign) }}>{children.length ? children : <>&nbsp;</>}</p>;
        case "listItem": return <li className={answerClass}>{children}</li>;
        case "bulletList": return <ul className={answerClass}>{children}</ul>;
        case "orderedList": return <ol className={answerClass} start={Number(value.attrs?.start ?? 1)}>{children}</ol>;
        case "inlineMath": return <span className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><MathFormula latex={readStringAttribute(value.attrs?.latex)} textSize={toMathTextSize(value.attrs?.textSize)}/></span>;
        case "blockMath": return <div className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><MathFormula latex={readStringAttribute(value.attrs?.latex)} textSize={toMathTextSize(value.attrs?.textSize)} block/></div>;
        case "imageRef": {
            const url = assetUrls.get(readStringAttribute(value.attrs?.assetId));
            return url
                ? <img className={`paper-image ${toImagePlacement(value.attrs?.placement)}${nodeUsesAnswerColor(node) ? " answer-color" : ""}`} style={{ width: `${Number(value.attrs?.widthPercent ?? 50)}%` }} src={url} alt={readStringAttribute(value.attrs?.alt)}/>
                : <div className="missing-asset">画像を読み込めません</div>;
        }
        case "richTable": return <div className={nodeUsesAnswerColor(node) ? "answer-color" : undefined}><PreviewTable rows={Array.isArray(value.attrs?.rows) ? value.attrs.rows as TableRow[] : []} headerRow={Boolean(value.attrs?.headerRow)} columnWidthsPercent={Array.isArray(value.attrs?.columnWidthsPercent) ? value.attrs.columnWidthsPercent as number[] : []} assetUrls={assetUrls} showAnswers={showAnswers}/></div>;
        default: return null;
    }
}
/**
 * isNodeVisibleInModeで表される条件を判定する。
 *
 * @param node 処理対象の値
 * @param showAnswers showAnswersとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function isNodeVisibleInMode(node: unknown, showAnswers: boolean): boolean {
    if (!node || typeof node !== "object")
        return false;
    if (nodeUsesAnswerColor(node))
        return showAnswers;
    const value = node as {
        type?: string;
        text?: string;
        content?: readonly unknown[];
    };
    if (value.type === "text")
        return Boolean(value.text);
    if (["hardBreak", "inlineMath", "blockMath", "imageRef", "richTable", "spacer"].includes(value.type ?? ""))
        return true;
    if (!Array.isArray(value.content) || value.content.length === 0)
        return value.type === "paragraph";
    return value.content.some((/**
     * 条件に一致する要素か判定する。
     *
     * @param child childとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function hasMatchingItem40(child) {
        return isNodeVisibleInMode(child, showAnswers);
    }));
}
/**
 * isUnderlinedAnswerTextで表される条件を判定する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function isUnderlinedAnswerText(node: unknown): boolean {
    if (!node || typeof node !== "object")
        return false;
    const value = node as {
        type?: string;
        text?: string;
        marks?: Array<{
            type?: string;
        }>;
    };
    return value.type === "text"
        && Boolean(value.text)
        && nodeUsesAnswerColor(node)
        && value.marks?.some((/**
         * 条件に一致する要素か判定する。
         *
         * @param mark markとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function hasMatchingItem41(mark) {
            return mark.type === "underline";
        })) === true;
}
/**
 * isAnswerOnlyNodeで表される条件を判定する。
 *
 * @param node 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function isAnswerOnlyNode(node: unknown): boolean {
    if (!node || typeof node !== "object")
        return false;
    if (nodeUsesAnswerColor(node))
        return true;
    const content = (node as {
        content?: readonly unknown[];
    }).content;
    if (!Array.isArray(content))
        return false;
    const visibleChildren = content.filter((/**
     * 対象要素を結果へ残すか判定する。
     *
     * @param child childとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function filterItem42(child) {
        return isNodeVisibleInMode(child, true);
    }));
    return visibleChildren.length > 0 && visibleChildren.every(isAnswerOnlyNode);
}
/**
 * PreviewTableコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function PreviewTable(props: {
    rows: TableRow[];
    headerRow: boolean;
    columnWidthsPercent: number[];
    assetUrls: ReadonlyMap<string, string>;
    showAnswers: boolean;
}) {
    let { rows, headerRow, columnWidthsPercent, assetUrls, showAnswers } = props;
    return <table className="paper-table"><colgroup>{columnWidthsPercent.map((/**
     * 各要素を画面表示または別形式へ変換する。
     *
     * @param width widthとして使用する値
     * @param index 対象となる位置
     * @returns 呼び出し元で使用する処理結果
     */
    function mapItem43(width, index) {
        return <col key={index} style={{ width: `${width}%` }}/>;
    }))}</colgroup><tbody>{rows.map((/**
         * 各要素を画面表示または別形式へ変換する。
         *
         * @param row rowとして使用する値
         * @param rowIndex rowIndexとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function mapItem44(row, rowIndex) {
            return <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((/**
                 * 各要素を画面表示または別形式へ変換する。
                 *
                 * @param cell cellとして使用する値
                 * @returns 呼び出し元で使用する処理結果
                 */
                function mapItem45(cell) {
                    const Cell = headerRow && rowIndex === 0 ? "th" : "td";
                    return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan}><RichDocument document={cell.document} assetUrls={assetUrls} showAnswers={showAnswers}/></Cell>;
                }))}</tr>;
        }))}</tbody></table>;
}
/**
 * toMathTextSizeの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function toMathTextSize(value: unknown): "small" | "normal" | "large" | "xLarge" {
    return value === "small" || value === "large" || value === "xLarge" ? value : "normal";
}
/**
 * readStringAttributeで必要な値を取得する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function readStringAttribute(value: unknown): string {
    return typeof value === "string" ? value : "";
}
/**
 * toTextAlignの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function toTextAlign(value: unknown): React.CSSProperties["textAlign"] {
    return value === "center" || value === "right" ? value : "left";
}
/**
 * toImagePlacementの入力値を必要な形式へ変換する。
 *
 * @param value 処理対象の値
 * @returns 呼び出し元で使用する処理結果
 */
function toImagePlacement(value: unknown): "block" | "floatLeft" | "floatRight" {
    return value === "floatLeft" || value === "floatRight" ? value : "block";
}
/**
 * StudentAnswerAreaコンポーネントを表示する。
 *
 * @param props 表示や操作に必要な設定
 * @returns 呼び出し元で使用する処理結果
 */
function StudentAnswerArea(props: {
    answerArea: AnswerAreaValue;
    showAnswers: boolean;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { answerArea, showAnswers, assetUrls } = props;
    return <div className="paper-student-answer-area">
    <div className={`paper-answer-response ${answerArea.style === "box" ? "paper-answer-box" : "paper-answer-lines"}`} style={{ minHeight: `${answerArea.rows * 1.7}em` }}>
      <RichDocument document={mergeColoredDocuments(answerArea.document, answerArea.answerDocument)} assetUrls={assetUrls} showAnswers={showAnswers}/>
    </div>
  </div>;
}
/**
 * hasVisibleAnswerAreaContentで表される条件を判定する。
 *
 * @param answerArea answerAreaとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function hasVisibleAnswerAreaContent(answerArea: AnswerAreaValue): boolean {
    return hasVisibleDocument(answerArea.document) || hasVisibleDocument(answerArea.answerDocument);
}
