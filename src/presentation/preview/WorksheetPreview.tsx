import { Fragment, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OVERSIZED_PAGINATION_ERROR, OVERSIZED_PAGINATION_MESSAGE } from "../../application/pdf/pdf-pagination-guard";
import { MARGINS_MM, PAGE_SIZES_MM } from "../../domain/worksheet/page-tokens";
import { colorDocumentAsAnswer, hasVisibleDocument, mergeColoredDocuments, nodeUsesAnswerColor } from "../../domain/worksheet/rich-text";
import type { AnswerArea as AnswerAreaValue, ContentBlock, ProblemBlock, SolutionRichTextDocument, SubQuestionNumberFormat, TableRow, Worksheet } from "../../domain/worksheet/worksheet";
import { formatProblemHeading, getProblemNumbers, getSubQuestionNumbers } from "../../domain/worksheet/worksheet.numbering";
import type { PreviewMode } from "../../application/pdf/generate-pdf";
import { MathFormula } from "../components/MathFormula";
import { planMeasuredPagination } from "./pagination";

// --------------------
// 型定義
// --------------------

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
 * プリントを用紙寸法へ改ページし、問題と解答の表示モードに応じたページ群を表示する。
 *
 * @param callbackInput プリント、表示モード、倍率、画像URL、改ページ状態の通知処理
 * @returns 用紙寸法で改ページしたプリントプレビュー
 */
function WorksheetPreview(callbackInput: Props) {
    let { worksheet, mode, zoom, assetUrls, onPageCountChange, onPaginationErrorChange, onPaginationReadyChange } = callbackInput;

    // --------------------
    // 改ページ状態と計算値
    // --------------------

    const numbers = useMemo((/**
     * get・問題・Numbersの結果を依存値から計算し、次の変更まで再利用する。
     *
     * @returns 依存値が変わるまで再利用する計算済みの派生値
     */
    function calculateMemoizedValue2() {
        return getProblemNumbers(worksheet);
    }), [worksheet]);
    const sections = useMemo<PreviewSection[]>((/**
     * 各要素を変換した配列を依存値から計算し、次の変更まで再利用する。
     *
     * @returns 依存値が変わるまで再利用する計算済みの派生値
     */
    function calculateMemoizedValue3() {
        const sectionModes = mode === "questionsAndAnswers"
            ? (["questions", "withAnswers"] as const)
            : ([mode] as const);
        return sectionModes.map((/**
         * 各区画単位の改ページ方式を表示または改ページの動作モード・atomsを持つオブジェクトへ変換する。
         *
         * @param sectionMode 区画単位の改ページ方式
         * @returns 表示または改ページの動作モード・atomsを持つオブジェクト
         */
        function mapItem4(sectionMode) {
            return ({
                mode: sectionMode,
                atoms: createRenderAtoms(worksheet, sectionMode, numbers),
            });
        }));
    }), [mode, numbers, worksheet]);
    const sectionStructureKey = useMemo((/**
     * JSON文字列を依存値から計算し、次の変更まで再利用する。
     *
     * @returns 依存値が変わるまで再利用する計算済みの派生値
     */
    function calculateMemoizedValue5() {
        return JSON.stringify(sections.map((/**
         * 各改ページまたは表示の対象となる問題区画を順序を保った要素一覧へ変換する。
         *
         * @param section 改ページまたは表示の対象となる問題区画
         * @returns 順序を保った要素一覧
         */
        function mapItem6(section) {
            return [
                section.mode,
                ...section.atoms.map((/**
                 * 各改ページ計算で扱う最小の描画単位を改ページ計算で扱う最小の描画単位の保存先または要素を特定するキーへ変換する。
                 *
                 * @param atom 改ページ計算で扱う最小の描画単位
                 * @returns 改ページ計算で扱う最小の描画単位の保存先または要素を特定するキー
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
     * 編集・プレビュー領域の幅変更を監視し、用紙が収まる倍率を再計算する。
     *
     * @returns 次回のEffect実行前またはコンポーネント破棄時に呼び出すクリーンアップ関数
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
         * Paginationを現在の編集結果へ反映する。
         *
         * @param current 更新前または現在の状態
         * @returns 値・readyを持つオブジェクト
         */
        function setPaginationCallback9(current) {
            return ({ ...current, ready: false });
        }));
        const measure = (/**
         * 非表示プレビューの実寸から改ページ計画を作り、計測完了状態へ反映する。
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
         * schedule・Measureをcancel・Animation・Frameで処理し、その結果を呼び出し元へ反映する。
         */
        function scheduleMeasureImplementation11() {
            if (!assetsReady)
                return;
            window.cancelAnimationFrame(animationFrame);
            animationFrame = window.requestAnimationFrame(measure);
        });
        const prepare = (/**
         * prepareをallで処理し、その結果を呼び出し元へ反映する。
         *
         * @returns prepareをallで処理し、その結果を呼び出し元へ反映する処理の完了時に解決するPromise
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
         * 各処理対象の要素についてobserveを実行し、対応関係または検証状態を更新する。
         *
         * @param element 走査または監視の対象となる要素
         */
        function processItem13(element) {
            return resizeObserver?.observe(element);
        }));
        return (/**
         * 登録したイベント購読・Object URL・一時状態を処理終了時に解放する。
         */
        function releaseResources14() {
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
     * 実寸DOMの計測結果から改ページ計画を更新し、画像読み込み後の寸法変化も反映する。
     */
    function synchronizeEffect15() {
        onPaginationReadyChange?.(paginationReady);
    }), [onPaginationReadyChange, paginationReady]);
    useEffect((/**
     * 実寸DOMの計測結果から改ページ計画を更新し、画像読み込み後の寸法変化も反映する。
     */
    function synchronizeEffect16() {
        if (!paginationReady)
            return;
        onPageCountChange?.(displayedPages.length);
        onPaginationErrorChange?.(paginationError);
    }), [displayedPages.length, onPageCountChange, onPaginationErrorChange, paginationError, paginationReady]);
    const atomLookup = new Map(sections.flatMap((/**
     * 各改ページまたは表示の対象となる問題区画を0件以上の結果へ変換し、一つの配列へ展開する。
     *
     * @param section 改ページまたは表示の対象となる問題区画
     * @returns 改ページまたは表示の対象となる問題区画のatoms
     */
    function expandItem17(section) {
        return section.atoms;
    })).map((/**
     * 各改ページ計算で扱う最小の描画単位を順序を保った要素一覧へ変換する。
     *
     * @param atom 改ページ計算で扱う最小の描画単位
     * @returns 順序を保った要素一覧
     */
    function mapItem18(atom) {
        return [atom.key, atom];
    })));
    // --------------------
    // 画面表示
    // --------------------

    return <div className="preview-pages" data-pagination-ready={paginationReady ? "true" : "false"} data-pagination-error={paginationError ? OVERSIZED_PAGINATION_ERROR : undefined} style={{ "--preview-zoom": zoom } as React.CSSProperties}>
    {paginationError && <div className="notice danger preview-pagination-error" role="alert">{paginationError}</div>}
    {displayedPages.map((/**
         * 各ブラウザー操作と描画確認に使うPlaywrightページを画面表示用のReact要素へ変換する。
         *
         * @param page ブラウザー操作と描画確認に使うPlaywrightページ
         * @param pageIndex プレビュー全体でのページ位置
         * @returns 画面表示用のReact要素
         */
        function mapItem19(page, pageIndex) {
            return <Fragment key={`${page.mode}:${page.sectionPageIndex}`}>
      <PreviewPage worksheet={worksheet} mode={page.mode} atoms={page.atomKeys.flatMap((/**
             * ページ計画に記録された断片キーを、対応する描画単位一覧へ展開する。
             *
             * @param key 改ページ計画に記録された描画単位キー
             * @returns キーに対応する描画単位一覧。未登録の場合は空配列
             */
            function expandItem20(key) {
                return atomLookup.get(key) ?? [];
            }))} assetUrls={assetUrls} showHeader={page.sectionPageIndex === 0} pageNumber={pageIndex + 1} totalPages={displayedPages.length}/>
    </Fragment>;
        }))}
    {needsMeasurement && <div className="preview-measurement" ref={measurementRef} aria-hidden="true">
      {sections.map((/**
         * 各改ページまたは表示の対象となる問題区画を画面表示用のReact要素へ変換する。
         *
         * @param section 改ページまたは表示の対象となる問題区画
         * @returns 画面表示用のReact要素
         */
        function mapItem21(section) {
            return <MeasurementPage key={section.mode} worksheet={worksheet} section={section} assetUrls={assetUrls}/>;
        }))}
    </div>}
  </div>;
}));
// --------------------
// ページ表示
// --------------------

/**
 * 改ページ計画の描画単位を一枚の用紙上へ配置し、ヘッダーとページ番号を表示する。
 *
 * @param props プレビュー・ページへ渡す表示情報と操作
 * @returns プレビュー・ページを表示するReact要素
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
     * 各改ページ計算で扱う最小の描画単位を画面表示用のReact要素へ変換する。
     *
     * @param atom 改ページ計算で扱う最小の描画単位
     * @returns 画面表示用のReact要素
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
 * 改ページ前の各描画単位を実寸で配置し、DOM寸法を計測できる非表示ページを作る。
 *
 * @param props Measurement・ページへ渡す表示情報と操作
 * @returns Measurement・ページを表示するReact要素
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
     * 各改ページ計算で扱う最小の描画単位を画面表示用のReact要素へ変換する。
     *
     * @param atom 改ページ計算で扱う最小の描画単位
     * @returns 画面表示用のReact要素
     */
    function mapItem23(atom) {
        return <div data-pagination-atom={atom.key} key={atom.key}><PreviewProblemFragment atom={atom} mode={section.mode} subQuestionNumberFormat={worksheet.pageSettings.subQuestionNumberFormat} assetUrls={assetUrls}/></div>;
    }))}
      </div>
    </div>
  </div>;
}
/**
 * 設定された学年・組・番号・氏名欄を含むプリント見出しを表示する。
 *
 * @param props プリント・ヘッダーへ渡す表示情報と操作
 * @returns プリント・ヘッダーを表示するReact要素
 */
function WorksheetHeader(props: {
    worksheet: Worksheet;
}) {
    let { worksheet } = props;
    return <header className="paper-header"><h2>{worksheet.title}</h2><div className="paper-fields">{worksheet.header.gradeField && <span className="grade-field"><i />年</span>}{worksheet.header.classField && <span className="class-field"><i />組</span>}{worksheet.header.numberField && <span className="number-field"><i />番</span>}{worksheet.header.nameField && <span className="name-field">名前<i /></span>}</div></header>;
}
/**
 * 改ページで分割された問題断片を、継続位置と解答表示モードに応じて描画する。
 *
 * @param props プレビュー・問題・Fragmentへ渡す表示情報と操作
 * @returns プレビュー・問題・Fragmentを表示するReact要素
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
// --------------------
// 描画単位の構築
// --------------------

/**
 * Render・Atomsを識別子・初期値・関連データが揃った新しい値として組み立てる。
 *
 * @param worksheet 処理対象となるプリント
 * @param mode 表示または改ページの動作モード
 * @param numbers 表示対象ごとの問題番号一覧
 * @returns atomsとして得た要素一覧
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
 * 問題・Headingを入力データまたは現在の状態から取り出す。
 *
 * @param worksheet 処理対象となるプリント
 * @param problem 処理対象の問題または例題
 * @param numbers 表示対象ごとの問題番号一覧
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function getProblemHeading(worksheet: Worksheet, problem: ProblemBlock, numbers: Map<string, string | null>): string | null {
    const number = numbers.get(problem.id) ?? null;
    return number === null
        ? null
        : formatProblemHeading(problem.kind, number, worksheet.pageSettings.problemNumberFormat);
}
/**
 * fallback・Pagesをmapで処理し、その結果を呼び出し元へ反映する。
 *
 * @param sections 改ページ対象となる問題区画一覧
 * @returns 各要素を変換した配列として得た要素一覧
 */
function fallbackPages(sections: readonly PreviewSection[]): PlannedPage[] {
    return sections.map((/**
     * 各改ページまたは表示の対象となる問題区画を表示または改ページの動作モード・区画内でのページ位置・改ページ結果と照合する描画単位の識別子一覧を持つオブジェクトへ変換する。
     *
     * @param section 改ページまたは表示の対象となる問題区画
     * @returns 表示または改ページの動作モード・区画内でのページ位置・改ページ結果と照合する描画単位の識別子一覧を持つオブジェクト
     */
    function mapItem24(section) {
        return ({
            mode: section.mode,
            sectionPageIndex: 0,
            atomKeys: section.atoms.map((/**
             * 各改ページ計算で扱う最小の描画単位を改ページ計算で扱う最小の描画単位の保存先または要素を特定するキーへ変換する。
             *
             * @param atom 改ページ計算で扱う最小の描画単位
             * @returns 改ページ計算で扱う最小の描画単位の保存先または要素を特定するキー
             */
            function mapItem25(atom) {
                return atom.key;
            })),
        });
    }));
}
// --------------------
// 改ページ計測
// --------------------

/**
 * pages・oversized・Atom・Keysを持つオブジェクトを一つの結果へまとめる。
 *
 * @param measurementRoot 寸法計測専用のプレビュールート要素
 * @param sections 改ページ対象となる問題区画一覧
 * @returns pages・oversized・Atom・Keysを持つオブジェクト
 */
function measurePages(measurementRoot: HTMLElement, sections: readonly PreviewSection[]): MeasuredPagePlan {
    const sectionPlans = sections.map((/**
     * 各改ページまたは表示の対象となる問題区画をpages・oversized・Atom・Keysを持つオブジェクトへ変換する。
     *
     * @param section 改ページまたは表示の対象となる問題区画
     * @returns pages・oversized・Atom・Keysを持つオブジェクト
     */
    function mapItem26(section): MeasuredPagePlan {
        const sectionElement = measurementRoot.querySelector<HTMLElement>(`[data-pagination-section="${section.mode}"]`);
        const paper = sectionElement?.querySelector<HTMLElement>(".paper-page");
        const header = sectionElement?.querySelector<HTMLElement>(".paper-header");
        const problemList = sectionElement?.querySelector<HTMLElement>(".paper-problems");
        if (!sectionElement || !paper || !header || !problemList) {
            return {
                pages: [{ mode: section.mode, sectionPageIndex: 0, atomKeys: section.atoms.map((/**
                         * 各改ページ計算で扱う最小の描画単位を改ページ計算で扱う最小の描画単位の保存先または要素を特定するキーへ変換する。
                         *
                         * @param atom 改ページ計算で扱う最小の描画単位
                         * @returns 改ページ計算で扱う最小の描画単位の保存先または要素を特定するキー
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
         * 各処理対象の要素を順序を保った要素一覧へ変換する。
         *
         * @param element 走査または監視の対象となる要素
         * @returns 順序を保った要素一覧
         */
        function mapItem28(element) {
            return [element.dataset.paginationAtom!, element];
        })));
        const measuredItems = section.atoms.map((/**
         * 各改ページ計算で扱う最小の描画単位を保存先または要素を特定するキー・要素またはページの高さ・ページ先頭が問題本体かどうか・break・Before・break・Afterを持つオブジェクトへ変換する。
         *
         * @param atom 改ページ計算で扱う最小の描画単位
         * @returns 保存先または要素を特定するキー・要素またはページの高さ・ページ先頭が問題本体かどうか・break・Before・break・Afterを持つオブジェクト
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
             * 各改ページ結果と照合する描画単位の識別子一覧を表示または改ページの動作モード・区画内でのページ位置・改ページ結果と照合する描画単位の識別子一覧を持つオブジェクトへ変換する。
             *
             * @param atomKeys 改ページ結果と照合する描画単位の識別子一覧
             * @param sectionPageIndex 区画内でのページ位置
             * @returns 表示または改ページの動作モード・区画内でのページ位置・改ページ結果と照合する描画単位の識別子一覧を持つオブジェクト
             */
            function mapItem30(atomKeys, sectionPageIndex) {
                return ({ mode: section.mode, sectionPageIndex, atomKeys });
            })),
            oversizedAtomKeys: plan.oversizedItemKeys,
        };
    }));
    return {
        pages: sectionPlans.flatMap((/**
         * 各改ページ計算で得たページ構成を0件以上の結果へ変換し、一つの配列へ展開する。
         *
         * @param plan 改ページ計算で得たページ構成
         * @returns 改ページ計算で得たページ構成のpages
         */
        function expandItem31(plan) {
            return plan.pages;
        })),
        oversizedAtomKeys: sectionPlans.flatMap((/**
         * 各改ページ計算で得たページ構成を0件以上の結果へ変換し、一つの配列へ展開する。
         *
         * @param plan 改ページ計算で得たページ構成
         * @returns 改ページ計算で得たページ構成のoversized・Atom・Keys
         */
        function expandItem32(plan) {
            return plan.oversizedAtomKeys;
        })),
    };
}
/**
 * outer・高さをget・Computed・Styleで処理し、その結果を呼び出し元へ反映する。
 *
 * @param element 走査または監視の対象となる要素
 * @returns 0から算出した数値
 */
function outerHeight(element: HTMLElement | undefined): number {
    if (!element)
        return 0;
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height + toPixels(style.marginTop) + toPixels(style.marginBottom);
}
/**
 * CSSの寸法文字列をレイアウト計算で扱えるピクセル数へ変換する。
 *
 * @param value to・Pixelsで判定または変換する入力値
 * @returns 条件に応じて選択した値から算出した数値
 */
function toPixels(value: string): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
/**
 * 改ページ計測を安定させるため、画像の読み込み成功または失敗まで待機する。
 *
 * @param image 表示または編集する画像
 * @returns 画像の読み込みが終了したときに解決するPromise
 */
function waitForImage(image: HTMLImageElement): Promise<void> {
    if (image.complete)
        return Promise.resolve();
    return new Promise((/**
     * 画像のload/errorイベントを、改ページ計測が待機できるPromiseへ変換する。
     *
     * @param resolve 非同期処理を正常完了させるPromise関数
     */
    function settlePromise33(resolve) {
        image.addEventListener("load", (/**
         * 画像の読み込み完了後に改ページ計測を再開する。
         *
         */
        function handleDomEvent34() {
            return resolve();
        }), { once: true });
        image.addEventListener("error", (/**
         * 読み込み失敗時も待機を終え、壊れた画像で処理が停止しないようにする。
         *
         */
        function handleDomEvent35() {
            return resolve();
        }), { once: true });
    }));
}
// --------------------
// 文書表示
// --------------------

export const WorksheetContentPreview = memo((/**
 * 問題本文の文書をプレビュー用の静的要素として描画する。
 *
 * @param callbackInput 表示する内容、解答表示の有無、小問番号形式、画像URL
 * @returns 内容種別に対応した静的プレビュー
 */
function WorksheetContentPreview(callbackInput: {
    content: ContentBlock;
    showAnswers: boolean;
    subQuestionNumberFormat: SubQuestionNumberFormat;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { content, showAnswers, subQuestionNumberFormat, assetUrls } = callbackInput;
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
                 * 各要素を画面表示用のReact要素へ変換する。
                 *
                 * @param item 配列処理で現在参照している要素
                 * @returns 画面表示用のReact要素
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
 * 教師用解説の文書を解答色を含む静的要素として描画する。
 *
 * @param props プリント・Solution・プレビューへ渡す表示情報と操作
 * @returns プリント・Solution・プレビューを表示するReact要素
 */
export function WorksheetSolutionPreview(props: {
    document: SolutionRichTextDocument;
    assetUrls: ReadonlyMap<string, string>;
}) {
    let { document, assetUrls } = props;
    return <RichDocument document={document} assetUrls={assetUrls} showAnswers/>;
}
/**
 * 保存済みリッチテキスト文書の段落・リスト・表をプレビュー要素へ変換する。
 *
 * @param props リッチ・文書へ渡す表示情報と操作
 * @returns リッチ・文書を表示するReact要素
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
     * 各ノードを画面表示用のReact要素へ変換する。
     *
     * @param node 走査または変換するリッチテキストノード
     * @param index 対象となる位置
     * @returns 画面表示用のReact要素
     */
    function mapItem38(node, index) {
        return <RichNode key={index} node={node} assetUrls={assetUrls} showAnswers={showAnswers}/>;
    }))}</div>;
}
/**
 * リッチ・ノードの内容と操作を、アクセシブルな画面要素として構成する。
 *
 * @param props リッチ・ノードへ渡す表示情報と操作
 * @returns リッチ・ノードを表示するReact要素
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
     * 各走査中の子ノードを画面表示用のReact要素へ変換する。
     *
     * @param child 走査中の子ノード
     * @param index 対象となる位置
     * @returns 画面表示用のReact要素
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
 * ノード・Visible・In・モードが仕様上の条件を満たすか判定する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @param showAnswers 解答をプレビューへ含めるかどうか
 * @returns この実装では常にfalse
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
     * いずれかの走査中の子ノードが要求条件を満たすか判定する。
     *
     * @param child 走査中の子ノード
     * @returns is・ノード・Visible・In・モードの結果が真になる場合はtrue
     */
    function hasMatchingItem40(child) {
        return isNodeVisibleInMode(child, showAnswers);
    }));
}
/**
 * Underlined・解答・テキストが仕様上の条件を満たすか判定する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns この実装では常にfalse
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
         * いずれかの処理対象の文字装飾が要求条件を満たすか判定する。
         *
         * @param mark 処理対象の文字装飾
         * @returns 処理対象の文字装飾の作成または検証する要素種別が「underline」と一致する場合はtrue
         */
        function hasMatchingItem41(mark) {
            return mark.type === "underline";
        })) === true;
}
/**
 * 解答・Only・ノードが仕様上の条件を満たすか判定する。
 *
 * @param node 走査または変換するリッチテキストノード
 * @returns この実装では常にfalse
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
     * is・ノード・Visible・In・モードの結果が真になる要素だけを後続処理へ残す。
     *
     * @param child 走査中の子ノード
     * @returns is・ノード・Visible・In・モードの結果が真になる場合はtrue
     */
    function filterItem42(child) {
        return isNodeVisibleInMode(child, true);
    }));
    return visibleChildren.length > 0 && visibleChildren.every(isAnswerOnlyNode);
}
// --------------------
// 表表示
// --------------------

/**
 * 保存済みの列幅・行高・セル文書を反映した表をプレビューへ描画する。
 *
 * @param props プレビュー・表へ渡す表示情報と操作
 * @returns プレビュー・表を表示するReact要素
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
     * 各要素または列へ適用する幅を画面表示用のReact要素へ変換する。
     *
     * @param width 要素または列へ適用する幅
     * @param index 対象となる位置
     * @returns 画面表示用のReact要素
     */
    function mapItem43(width, index) {
        return <col key={index} style={{ width: `${width}%` }}/>;
    }))}</colgroup><tbody>{rows.map((/**
         * 各処理対象の表の行を画面表示用のReact要素へ変換する。
         *
         * @param row 処理対象の表の行
         * @param rowIndex 表内での行位置
         * @returns 画面表示用のReact要素
         */
        function mapItem44(row, rowIndex) {
            return <tr key={row.id} style={row.heightMm ? { height: `${row.heightMm}mm` } : undefined}>{row.cells.map((/**
                 * 各処理対象の表セルを画面表示用のReact要素へ変換する。
                 *
                 * @param cell 処理対象の表セル
                 * @returns 画面表示用のReact要素
                 */
                function mapItem45(cell) {
                    const Cell = headerRow && rowIndex === 0 ? "th" : "td";
                    return <Cell key={cell.id} rowSpan={cell.rowSpan} colSpan={cell.columnSpan}><RichDocument document={cell.document} assetUrls={assetUrls} showAnswers={showAnswers}/></Cell>;
                }))}</tr>;
        }))}</tbody></table>;
}
// --------------------
// 補助関数
// --------------------

/**
 * to・数式・テキスト・寸法を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value to・数式・テキスト・寸法で判定または変換する入力値
 * @returns 条件に応じて選択した値
 */
function toMathTextSize(value: unknown): "small" | "normal" | "large" | "xLarge" {
    return value === "small" || value === "large" || value === "xLarge" ? value : "normal";
}
/**
 * String・Attributeを入力データまたは現在の状態から取り出す。
 *
 * @param value read・String・Attributeで判定または変換する入力値
 * @returns 条件に応じて選択した値として得た文字列。変換できない場合は関数固有の既定値
 */
function readStringAttribute(value: unknown): string {
    return typeof value === "string" ? value : "";
}
/**
 * to・テキスト・Alignを比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value to・テキスト・Alignで判定または変換する入力値
 * @returns 条件に応じて選択した値
 */
function toTextAlign(value: unknown): React.CSSProperties["textAlign"] {
    return value === "center" || value === "right" ? value : "left";
}
/**
 * to・画像・配置を比較・保存・表示先が要求する形式へ変換する。
 *
 * @param value to・画像・配置で判定または変換する入力値
 * @returns 条件に応じて選択した値
 */
function toImagePlacement(value: unknown): "block" | "floatLeft" | "floatRight" {
    return value === "floatLeft" || value === "floatRight" ? value : "block";
}
/**
 * 罫線・方眼・空白など設定された形式の生徒用解答欄を表示する。
 *
 * @param props Student・解答・Areaへ渡す表示情報と操作
 * @returns Student・解答・Areaを表示するReact要素
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
 * Visible・解答・Area・内容が仕様上の条件を満たすか判定する。
 *
 * @param answerArea 解答欄の表示領域
 * @returns has・Visible・文書の結果が真になるまたはhas・Visible・文書の結果が真になる場合はtrue
 */
function hasVisibleAnswerAreaContent(answerArea: AnswerAreaValue): boolean {
    return hasVisibleDocument(answerArea.document) || hasVisibleDocument(answerArea.answerDocument);
}
