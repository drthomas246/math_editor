import { performance } from "node:perf_hooks";
import { produceWithPatches } from "immer";
import type { Worksheet } from "../src/domain/worksheet/worksheet";
import { createProblem, createRichTextBlock, createWorksheet } from "../src/domain/worksheet/worksheet.defaults";
import { useEditorStore } from "../src/presentation/editor/editor-store";
const PROBLEM_COUNT = 100;
const CONTENTS_PER_PROBLEM = 20;
const PARAGRAPHS_PER_CONTENT = 10;
const WARMUP_ITERATIONS = 3;
const MEASURE_ITERATIONS = 20;
type BenchmarkResult = {
    totalMs: number;
    medianMs: number;
    p95Ms: number;
};
/**
 * createBenchmarkWorksheetで必要な値を作成する。
 *
 * @returns 呼び出し元で使用する処理結果
 */
function createBenchmarkWorksheet(): Worksheet {
    const worksheet = createWorksheet(new Date("2026-08-21T00:00:00.000Z"));
    worksheet.problems = Array.from({ length: PROBLEM_COUNT }, (/**
     * fromへ渡す処理を実行する。
     *
     * @param _ _として使用する値
     * @param problemIndex problemIndexとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function fromCallback1(_, problemIndex) {
        const problem = createProblem();
        problem.contents = Array.from({ length: CONTENTS_PER_PROBLEM }, (/**
         * fromへ渡す処理を実行する。
         *
         * @param _ _として使用する値
         * @param contentIndex contentIndexとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function fromCallback2(_, contentIndex) {
            const content = createRichTextBlock();
            content.document.content = Array.from({ length: PARAGRAPHS_PER_CONTENT }, (/**
             * fromへ渡す処理を実行する。
             *
             * @param _ _として使用する値
             * @param paragraphIndex paragraphIndexとして使用する値
             * @returns 呼び出し元で使用する処理結果
             */
            function fromCallback3(_, paragraphIndex) {
                return ({
                    type: "paragraph" as const,
                    attrs: { textAlign: "left" as const },
                    content: [{
                            type: "text" as const,
                            text: `問題${problemIndex + 1} 内容${contentIndex + 1} 段落${paragraphIndex + 1} `.repeat(3),
                        }],
                });
            }));
            return content;
        }));
        return problem;
    }));
    return worksheet;
}
/**
 * measureで必要な値を取得する。
 *
 * @param operation operationとして使用する値
 * @returns 呼び出し元で使用する処理結果
 */
function measure(operation: (iteration: number) => void): BenchmarkResult {
    for (let iteration = 0; iteration < WARMUP_ITERATIONS; iteration += 1)
        operation(iteration);
    const durations: number[] = [];
    for (let iteration = 0; iteration < MEASURE_ITERATIONS; iteration += 1) {
        const startedAt = performance.now();
        operation(iteration + WARMUP_ITERATIONS);
        durations.push(performance.now() - startedAt);
    }
    const sorted = [...durations].sort((/**
     * 表示順を決めるため二つの要素を比較する。
     *
     * @param left leftとして使用する値
     * @param right rightとして使用する値
     * @returns 呼び出し元で使用する処理結果
     */
    function compareItems4(left, right) {
        return left - right;
    }));
    return {
        totalMs: durations.reduce((/**
         * 各要素を一つの集計結果へまとめる。
         *
         * @param total totalとして使用する値
         * @param duration durationとして使用する値
         * @returns 呼び出し元で使用する処理結果
         */
        function reduceItems5(total, duration) {
            return total + duration;
        }), 0),
        medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
        p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0,
    };
}
/**
 * updateTargetTextの対象となる状態を更新する。
 *
 * @param worksheet worksheetとして使用する値
 * @param text textとして使用する値
 */
function updateTargetText(worksheet: Worksheet, text: string): void {
    const content = worksheet.problems[50]?.contents[10];
    if (content?.type !== "richText")
        throw new Error("ベンチマーク対象を作成できませんでした");
    content.document.content = [{
            type: "paragraph",
            attrs: { textAlign: "left" },
            content: [{ type: "text", text }],
        }];
}
const fixture = createBenchmarkWorksheet();
let legacyWorksheet = structuredClone(fixture);
const legacy = measure((/**
 * measureへ渡す処理を実行する。
 *
 * @param iteration iterationとして使用する値
 */
function measureCallback6(iteration) {
    const nextWorksheet = structuredClone(legacyWorksheet);
    updateTargetText(nextWorksheet, `legacy-${iteration}`);
    if (JSON.stringify(legacyWorksheet) !== JSON.stringify(nextWorksheet)) {
        produceWithPatches(legacyWorksheet, (/**
         * produceWithPatchesへ渡す処理を実行する。
         *
         * @param draft draftとして使用する値
         */
        function produceWithPatchesCallback7(draft) {
            Object.assign(draft, nextWorksheet);
        }));
        legacyWorksheet = nextWorksheet;
    }
}));
useEditorStore.getState().initialize(structuredClone(fixture));
const targetProblemId = fixture.problems[50]!.id;
const targetContentId = fixture.problems[50]!.contents[10]!.id;
const optimized = measure((/**
 * measureへ渡す処理を実行する。
 *
 * @param iteration iterationとして使用する値
 */
function measureCallback8(iteration) {
    useEditorStore.getState().mutate("本文を編集", (/**
     * mutateへ渡す処理を実行する。
     *
     * @param draft draftとして使用する値
     */
    function mutateCallback9(draft) {
        const problem = draft.problems.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem10(item) {
            return item.id === targetProblemId;
        }));
        const content = problem?.contents.find((/**
         * 検索条件に一致する要素か判定する。
         *
         * @param item 処理対象の値
         * @returns 呼び出し元で使用する処理結果
         */
        function findItem11(item) {
            return item.id === targetContentId;
        }));
        if (content?.type !== "richText")
            throw new Error("ベンチマーク対象が見つかりません");
        content.document.content = [{
                type: "paragraph",
                attrs: { textAlign: "left" },
                content: [{ type: "text", text: `optimized-${iteration}` }],
            }];
    }), { historyGroup: `richText:${targetProblemId}:${targetContentId}` });
}));
const speedup = legacy.totalMs / Math.max(optimized.totalMs, Number.EPSILON);
console.log(JSON.stringify({
    dataset: {
        problems: PROBLEM_COUNT,
        contentsPerProblem: CONTENTS_PER_PROBLEM,
        paragraphsPerContent: PARAGRAPHS_PER_CONTENT,
        measuredKeystrokes: MEASURE_ITERATIONS,
    },
    legacyWholeWorksheetMs: legacy,
    partialImmerMs: optimized,
    totalSpeedup: Number(speedup.toFixed(2)),
}, null, 2));
